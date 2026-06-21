import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { Titlebar } from '../../components/titlebar'
import { useConfigStore } from '../../stores/config_store'
import { ocrServiceRegistry, translateServiceRegistry } from '../../services/registry'
import { detectLanguage } from '../../services/detect'
import { native_language_name } from '../../i18n/language_names'
import { getServiceKey } from '@shared/types/service'
import { LANGUAGE_CODES } from '@shared/types/language'
import { normalize_recognized_text } from '@shared/text_normalize'
import { create_logger } from '../../utils/logger'
import { log_error, get_service_config, try_qr_decode, QRCODE_INSTANCE_KEY } from './recognize_helpers'
import { PillSelect, SvcTile, OCR_META } from './pill_select'
import { ExportButton } from './export_button'
import { ImageCard } from './image_card'
import { RecognizeContent } from './recognize_content'
import { show_toast } from '../../stores/toast_store'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'

const log = create_logger('recognize')

export default function RecognizeWindow(): React.ReactElement {
    const { t } = useTranslation()
    const [mode, setMode] = useState<'recognize' | 'translate'>('recognize')
    const [imageBase64, setImageBase64] = useState<string>('')
    const [recognizedText, setRecognizedText] = useState<string>('')
    const [translatedText, setTranslatedText] = useState<string>('')
    const [alwaysOnTop, setAlwaysOnTop] = useState(() => useConfigStore.getState().config.recognize_always_on_top)
    const configPinned = useConfigStore((s) => s.config.recognize_pinned)
    const pinned = configPinned || alwaysOnTop
    const [selectedService, setSelectedService] = useState<string>(() => useConfigStore.getState().config.recognize_engine)
    const [selectedLanguage, setSelectedLanguage] = useState<string>(() => useConfigStore.getState().config.recognize_language)
    const [targetLanguage, setTargetLanguage] = useState<string>('')
    const [isRecognizing, setIsRecognizing] = useState(false)
    const [isTranslating, setIsTranslating] = useState(false)
    const [recognizeShowId, setRecognizeShowId] = useState(0)
    const [qr_detected, setQrDetected] = useState(false)
    const [effectiveTargetLang, setEffectiveTargetLang] = useState<LanguageCode | null>(null)
    const [lockedTargetLang, setLockedTargetLang] = useState<LanguageCode | null>(null)
    const [detectedSourceLang, setDetectedSourceLang] = useState<LanguageCode | null>(null)

    const config = useConfigStore((s) => s.config)
    const ocrRequestIdRef = useRef(0)
    const autoOcrImageRef = useRef('')
    const lastOcrKeyRef = useRef('')
    const recognizeAutoCopyRef = useRef(config.recognize_auto_copy)
    recognizeAutoCopyRef.current = config.recognize_auto_copy
    const handleNormalizeTextRef = useRef<(text: string) => string>((text) => text)

    const handleNormalizeText = useCallback((text: string): string => {
        return config.recognize_delete_newline ? normalize_recognized_text(text) : text
    }, [config.recognize_delete_newline])
    handleNormalizeTextRef.current = handleNormalizeText

    // Listen for new screenshots from main process
    useEffect(() => {
        const unsub = window.electronAPI.ocr.onRecognizeShow((base64, text, m) => {
            const next_text = handleNormalizeTextRef.current(text)
            setRecognizeShowId((current) => current + 1)
            setImageBase64(base64)
            setRecognizedText(next_text)
            setTranslatedText('')
            setQrDetected(false)
            setEffectiveTargetLang(null)
            setLockedTargetLang(null)
            setDetectedSourceLang(null)
            setMode(m === 'translate' ? 'translate' : 'recognize')
            if (recognizeAutoCopyRef.current && next_text) {
                window.electronAPI.text.writeClipboard(next_text).catch(() => undefined)
            }
        })
        return unsub
    }, [])

    useEffect(() => {
        window.electronAPI.ready('recognize')
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') window.electronAPI.window.close().catch((err: unknown) => { log_error('close window', err) })
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => { window.removeEventListener('keydown', handleKeyDown); }
    }, [])

    const service_instances = config.service_instances
    const base_service_list = useMemo(() => config.recognize_service_list.filter((instance_key) => get_service_config(service_instances, instance_key).enable !== false), [config.recognize_service_list, service_instances])
    const service_list = useMemo(() => qr_detected && !base_service_list.includes(QRCODE_INSTANCE_KEY) ? [...base_service_list, QRCODE_INSTANCE_KEY] : base_service_list, [qr_detected, base_service_list])

    // Build OCR engine options from service list
    const ocr_engine_options = service_list.map((instanceKey) => {
        const svcKey = getServiceKey(instanceKey)
        const svc = ocrServiceRegistry.get(svcKey)
        return {
            value: instanceKey,
            label: OCR_META[svcKey]?.name ?? svc?.name ?? svcKey,
            mono: svcKey,
        }
    })

    // Build language options (source includes auto, target excludes auto)
    const lang_options = [
        { value: 'auto', label: native_language_name(t, 'auto') },
        ...LANGUAGE_CODES.filter((c) => c !== 'auto').map((code) => ({
            value: code,
            label: native_language_name(t, code),
        })),
    ]
    const target_lang_options = LANGUAGE_CODES.filter((c) => c !== 'auto').map((code) => ({
        value: code,
        label: native_language_name(t, code),
    }))

    const effectiveService = qr_detected ? QRCODE_INSTANCE_KEY : (selectedService && service_list.includes(selectedService) ? selectedService : service_list[0] || '')
    const effectiveServiceKey = effectiveService ? getServiceKey(effectiveService) : ''
    const effectiveMeta = effectiveServiceKey ? (OCR_META[effectiveServiceKey] ?? null) : null

    const effectiveTarget = lockedTargetLang || targetLanguage || config.translate_target_language || 'zh_cn'

    // ---- Request ID guard for OCR ----
    const bumpOcrRequestId = useCallback((): number => {
        ocrRequestIdRef.current += 1
        return ocrRequestIdRef.current
    }, [])

    // Auto-re-recognize when OCR language or service changes
    useEffect(() => {
        if (!imageBase64) return
        const ocr_key = `${imageBase64.slice(0, 64)}:${selectedLanguage}:${effectiveService}`
        if (lastOcrKeyRef.current === ocr_key) return
        lastOcrKeyRef.current = ocr_key
        handleRecognize().catch((err: unknown) => { log_error('recognize', err) })
    }, [selectedLanguage, effectiveService]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (mode !== 'recognize') return
        if (!imageBase64 || recognizedText.trim()) return
        const auto_ocr_key = `${String(recognizeShowId)}:${imageBase64}`
        if (autoOcrImageRef.current === auto_ocr_key) return
        autoOcrImageRef.current = auto_ocr_key
        handleRecognize().catch((err: unknown) => { log_error('recognize', err) })
    }, [mode, imageBase64, recognizedText, recognizeShowId]) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-translate when screenshot translate opens with pre-recognized text
    const doTranslateRef = useRef(doTranslate)
    doTranslateRef.current = doTranslate

    useEffect(() => {
        if (mode !== 'translate') return
        if (!recognizedText) return
        if (recognizeShowId === 0) return
        const requestId = bumpOcrRequestId()
        setIsTranslating(true)
        doTranslateRef.current(recognizedText, (selectedLanguage || 'auto') as LanguageCode, requestId)
            .finally(() => { if (ocrRequestIdRef.current === requestId) setIsTranslating(false) })
            .catch((err: unknown) => { log_error('translate recognized text', err) })
    }, [mode, recognizedText, recognizeShowId, selectedLanguage, bumpOcrRequestId])

    // ---- Translate (used in translate mode) ----
    const doTranslate = useCallback(async (text: string, sourceLang: LanguageCode, requestId: number): Promise<void> => {
        const translateServiceList = useConfigStore.getState().config.translate_service_list
        const svcInstances = useConfigStore.getState().config.service_instances
        const enabledList = translateServiceList.filter((ik) => get_service_config(svcInstances, ik).enable !== false)
        if (enabledList.length === 0) return

        const secondLanguage = useConfigStore.getState().config.translate_second_language

        let detectedSource: LanguageCode | null = null
        if (sourceLang === 'auto') {
            detectedSource = await detectLanguage(text)
            if (ocrRequestIdRef.current !== requestId) return
        }
        setDetectedSourceLang(detectedSource)

        let effectiveTargetLangLocal = (lockedTargetLang || effectiveTarget) as LanguageCode
        if (!lockedTargetLang && sourceLang === 'auto' && detectedSource && detectedSource === effectiveTargetLangLocal) {
            effectiveTargetLangLocal = (secondLanguage || 'en') as LanguageCode
            setLockedTargetLang(effectiveTargetLangLocal)
        }
        setEffectiveTargetLang(effectiveTargetLangLocal !== effectiveTarget ? effectiveTargetLangLocal : null)
        const effectiveSource = sourceLang === 'auto' ? (detectedSource ?? 'auto') : sourceLang

        const firstInstanceKey = enabledList[0]
        if (!firstInstanceKey) return
        const svcKey = getServiceKey(firstInstanceKey)
        const service = translateServiceRegistry.get(svcKey)
        if (!service) return

        const instanceConfig = get_service_config(svcInstances, firstInstanceKey)
        try {
            if (service.translateStream) {
                let accumulated = ''
                for await (const chunk of service.translateStream(text, effectiveSource, effectiveTargetLangLocal, instanceConfig)) {
                    if (ocrRequestIdRef.current !== requestId) return
                    accumulated += chunk
                    setTranslatedText(accumulated)
                }
            } else {
                const result = await service.translate(text, effectiveSource, effectiveTargetLangLocal, instanceConfig)
                if (ocrRequestIdRef.current !== requestId) return
                const translated = typeof result === 'string' ? result : result.definitions.map((d) => `${d.part_of_speech ? `[${d.part_of_speech}] ` : ''}${d.meanings.join('; ')}`).join('\n')
                setTranslatedText(translated)
            }
        } catch {
            // keep existing on failure
        }
    }, [effectiveTarget, lockedTargetLang])

    // ---- OCR ----
    const handleRecognize = useCallback(async () => {
        if (!imageBase64) return
        const requestId = bumpOcrRequestId()
        setIsRecognizing(true)
        setTranslatedText('')

        try {
            // QR auto-detect: fast pixel scan before running the selected OCR engine
            const qr = await try_qr_decode(imageBase64)
            if (ocrRequestIdRef.current !== requestId) return
            if (qr) {
                log.info('ocr: auto-detected QR code')
                setQrDetected(true)
                const next_text = handleNormalizeText(qr)
                setRecognizedText(next_text)
                if (config.recognize_auto_copy && next_text) {
                    await window.electronAPI.text.writeClipboard(next_text).catch(() => undefined)
                }
                if (mode === 'translate' && next_text) {
                    setIsTranslating(true)
                    await doTranslate(next_text, 'auto', requestId)
                    setIsTranslating(false)
                }
                return
            }

            setQrDetected(false)
            const lang = (selectedLanguage || config.recognize_language) as LanguageCode

            // Parallel OCR: try all enabled engines concurrently, use first success
            const enabledEngines = service_list.filter((ik) => {
                const svcKey = getServiceKey(ik)
                return !!ocrServiceRegistry.get(svcKey)
            })
            if (enabledEngines.length === 0) return

            const start = Date.now()
            let result = ''

            if (enabledEngines.length === 1) {
                const ik = enabledEngines[0]
                const svc_key = getServiceKey(ik)
                const service = ocrServiceRegistry.get(svc_key)
                if (!service) return
                const instance_config: ServiceConfig = get_service_config(service_instances, ik)
                log.info('ocr start: engine=%s, lang=%s', svc_key, lang)
                result = await service.recognize(imageBase64, lang, instance_config) || ''
            } else {
                log.info('ocr start: %d engines in parallel, lang=%s', enabledEngines.length, lang)
                result = await new Promise<string>((resolve) => {
                    let settled = false
                    for (const ik of enabledEngines) {
                        const svc_key = getServiceKey(ik)
                        const service = ocrServiceRegistry.get(svc_key)
                        if (!service) continue
                        const instance_config: ServiceConfig = get_service_config(service_instances, ik)
                        service.recognize(imageBase64, lang, instance_config)
                            .then((text) => {
                                if (settled) return
                                settled = true
                                log.info('ocr done: engine=%s, elapsed=%dms', svc_key, Date.now() - start)
                                resolve(text || '')
                            })
                            .catch(() => {
                                // try next engine; if all fail, resolve empty
                            })
                    }
                    // Fallback: if all fail, resolve empty after timeout
                    setTimeout(() => { if (!settled) { settled = true; resolve('') } }, 30000)
                })
            }

            if (ocrRequestIdRef.current !== requestId) return
            log.info('ocr done: engine=%s, elapsed=%dms, length=%d', svc_key, Date.now() - start, (result || '').length)
            const next_text = handleNormalizeText(result || '')
            setRecognizedText(next_text)
            if (config.recognize_auto_copy && next_text) {
                await window.electronAPI.text.writeClipboard(next_text).catch(() => undefined)
            }
            if (mode === 'translate' && next_text) {
                setIsTranslating(true)
                await doTranslate(next_text, lang, requestId)
                setIsTranslating(false)
            }
        } catch (err) {
            log.error('ocr failed: error=%s', err instanceof Error ? err.message : String(err))
        }
        if (ocrRequestIdRef.current === requestId) {
            setIsRecognizing(false)
        }
    }, [imageBase64, selectedLanguage, service_list, service_instances, config.recognize_language, config.recognize_auto_copy, mode, bumpOcrRequestId, handleNormalizeText, doTranslate])

    // Auto-re-translate when target language changes in translate mode
    useEffect(() => {
        if (mode !== 'translate') return
        if (!recognizedText) return
        const requestId = bumpOcrRequestId()
        setIsTranslating(true)
        doTranslate(recognizedText, (selectedLanguage || 'auto') as LanguageCode, requestId)
            .finally(() => { if (ocrRequestIdRef.current === requestId) setIsTranslating(false) })
            .catch((err: unknown) => { log_error('translate recognized text', err) })
    }, [targetLanguage, effectiveTarget]) // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Handlers ----
    const handleCopy = useCallback(async () => {
        if (recognizedText) {
            await window.electronAPI.text.writeClipboard(recognizedText).then(() => {
                show_toast(t('toast.copied', { defaultValue: '已复制' }))
            }).catch(() => undefined)
        }
    }, [recognizedText, t])

    const handleTranslate = useCallback(async () => {
        setMode('translate')
        setTranslatedText('')
        if (!recognizedText) return
        const requestId = bumpOcrRequestId()
        setIsTranslating(true)
        try {
            await doTranslate(recognizedText, (selectedLanguage || 'auto') as LanguageCode, requestId)
        } finally {
            setIsTranslating(false)
        }
    }, [recognizedText, selectedLanguage, bumpOcrRequestId, doTranslate])

    const handleDeleteNewline = useCallback(() => {
        setRecognizedText(normalize_recognized_text(recognizedText))
        show_toast(t('toast.newline_removed', { defaultValue: '已去除换行' }))
    }, [recognizedText, t])

    const handleDeleteAllSpaces = useCallback(() => {
        setRecognizedText(recognizedText.replace(/ +/g, ''))
        show_toast(t('toast.spaces_removed', { defaultValue: '已去除空格' }))
    }, [recognizedText, t])

    const handleClose = useCallback(() => {
        window.electronAPI.window.close().catch((err: unknown) => { log_error('close window', err) })
    }, [])

    const handleTogglePin = useCallback(() => {
        useConfigStore.getState().set('recognize_pinned', !configPinned)
    }, [configPinned])

    const handleToggleAlwaysOnTop = useCallback(() => {
        const next = !alwaysOnTop
        setAlwaysOnTop(next)
        window.electronAPI.window.setAlwaysOnTop(next)
            .then(() => { useConfigStore.getState().set('recognize_always_on_top', next) })
            .catch((err: unknown) => { log_error('set always on top', err) })
    }, [alwaysOnTop])

    const handleCopyImage = useCallback(async () => {
        if (!imageBase64) return
        await window.electronAPI.text.write_clipboard_image(imageBase64)
        show_toast(t('toast.image_copied', { defaultValue: '图片已复制' }))
    }, [imageBase64, t])

    const handleSwap = useCallback(() => {
        if (selectedLanguage === 'auto') {
            if (!detectedSourceLang) return
            const newTarget = selectedLanguage
            setSelectedLanguage(detectedSourceLang)
            setLockedTargetLang(newTarget)
            return
        }
        const prev_source = selectedLanguage as LanguageCode
        setSelectedLanguage(effectiveTarget)
        setLockedTargetLang(prev_source)
    }, [selectedLanguage, effectiveTarget, detectedSourceLang])

    const is_translate_mode = mode === 'translate'
    const modeLabel = is_translate_mode ? t('recognize.translate') : t('recognize.title')

    return (
        <div className="op-window">
            {/* Titlebar */}
            <Titlebar
                alwaysOnTop={alwaysOnTop}
                pinned={pinned}
                onToggleTopmost={handleToggleAlwaysOnTop}
                onTogglePin={handleTogglePin}
                modeLabel={modeLabel}
                onClose={handleClose}
            />

            {/* Dual-pane: image | text */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0, gap: 10, padding: '4px 10px 8px' }}>
                {/* Image card */}
                <ImageCard imageBase64={imageBase64} />

                {/* Right column: single card (recognize) or dual cards (translate) */}
                <RecognizeContent
                    isTranslateMode={is_translate_mode}
                    recognizedText={recognizedText}
                    translatedText={translatedText}
                    isRecognizing={isRecognizing}
                    isTranslating={isTranslating}
                    detectedSourceLang={detectedSourceLang}
                    effectiveTargetLang={effectiveTargetLang}
                    effectiveTarget={effectiveTarget}
                    onTextChange={setRecognizedText}
                />
            </div>

            {/* Action bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px 10px',
                borderTop: '1px solid var(--line)',
            }}>
                {/* Left: Copy Image */}
                <button className="ic-btn" title={t('recognize.copy_image', { defaultValue: '复制图片' })} data-testid="ocr-copy-image-btn" onClick={() => { handleCopyImage().catch((err: unknown) => { log_error('copy image', err) }); }} disabled={!imageBase64}>
                    <Icons.Image size={16} />
                </button>
                {/* OCR Engine Select */}
                {ocr_engine_options.length > 0 && (
                    <PillSelect
                        value={effectiveService}
                        options={ocr_engine_options}
                        leading={effectiveMeta ? <SvcTile name={effectiveServiceKey} size={18} /> : undefined}
                        onChange={setSelectedService}
                        testId="ocr-engine-select"
                    />
                )}
                {/* Language selector (no Globe icon) */}
                <PillSelect
                    value={selectedLanguage}
                    options={lang_options}
                    onChange={setSelectedLanguage}
                    testId="ocr-lang-select"
                />

                {/* Translate mode extras: swap + target language */}
                {is_translate_mode && (
                    <>
                        <button className="ic-btn" title={t('swap_languages')} data-testid="ocr-swap-btn" onClick={handleSwap}>
                            <Icons.Swap size={16} />
                        </button>
                        <PillSelect
                            value={effectiveTargetLang ?? effectiveTarget}
                            options={target_lang_options}
                            onChange={(lang: string) => { setTargetLanguage(lang); setLockedTargetLang(lang as LanguageCode); }}
                            testId="ocr-target-lang-select"
                        />
                    </>
                )}

                <div style={{ flex: 1 }} />

                {/* Right side actions */}
                {!is_translate_mode && (
                    <button
                        className="ic-btn"
                        data-testid="ocr-translate-btn"
                        title={t('recognize.translate')}
                        style={{ color: recognizedText ? 'var(--brand-primary)' : 'var(--text-mute)' }}
                        onClick={() => { handleTranslate().catch((err: unknown) => { log_error('translate recognized text', err) }); }}
                        disabled={!recognizedText}
                    >
                        <Icons.Translate size={18} />
                    </button>
                )}
                <button className="ic-btn" title={t('delete_newline')} data-testid="ocr-newline-btn" onClick={handleDeleteNewline} disabled={!recognizedText}>
                    <Icons.Newline size={16} />
                </button>
                <button className="ic-btn" title={t('delete_spaces')} data-testid="ocr-space-btn" onClick={handleDeleteAllSpaces} disabled={!recognizedText}>
                    <Icons.Space size={16} />
                </button>
                <button className="ic-btn" title={t('recognize.copy_recognized_text', { defaultValue: '复制识别文本' })} data-testid="ocr-copy-btn" onClick={() => { handleCopy().catch((err: unknown) => { log_error('copy recognized text', err) }); }} disabled={!recognizedText}>
                    <Icons.Copy size={16} />
                </button>
                <ExportButton text={is_translate_mode ? translatedText : recognizedText} />
            </div>

            {/* Spin animation for recognizing state */}
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}
