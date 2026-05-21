import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfigStore } from '../../stores/config_store'
import { ocrServiceRegistry, translateServiceRegistry } from '../../services/registry'
import { detectLanguage } from '../../services/detect'
import { native_language_name } from '../../i18n/language_names'
import { getServiceKey } from '@shared/types/service'
import { LANGUAGE_CODES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'

function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

// OCR engine metadata (subset of SVC_META for action bar)
const OCR_META: Partial<Record<string, { name: string; mono: string; tone: string }>> = {
    system: { name: '系统文字识别', mono: 'SY', tone: 'oklch(54% 0.005 70)' },
    tesseract: { name: 'Tesseract', mono: 'TE', tone: 'oklch(58% 0.10 50)' },
    openai_compatible: { name: 'AI 视觉', mono: 'VL', tone: 'oklch(58% 0.02 180)' },
    baidu_accurate_ocr: { name: '百度高精度', mono: 'BA', tone: 'oklch(58% 0.16 250)' },
    baidu_ocr: { name: '百度文字识别', mono: 'BD', tone: 'oklch(58% 0.16 250)' },
    tencent_ocr: { name: '腾讯文字识别', mono: 'TC', tone: 'oklch(60% 0.13 230)' },
    iflytek_ocr: { name: '讯飞文字识别', mono: 'IF', tone: 'oklch(60% 0.13 220)' },
    iflytek_latex_ocr: { name: '讯飞 LaTeX', mono: 'TX', tone: 'oklch(60% 0.13 220)' },
    qrcode: { name: '二维码', mono: 'QR', tone: 'oklch(50% 0.01 70)' },
}

import { normalize_recognized_text } from '@shared/text_normalize'

function SvcTile({ name, size = 22 }: { name: string; size?: number }): React.ReactElement {
    const m = OCR_META[name] ?? { mono: name.slice(0, 2).toUpperCase(), tone: 'oklch(55% 0.005 70)' }
    return (
        <div
            className="svc-tile"
            style={{
                width: size,
                height: size,
                fontSize: size >= 28 ? 11 : 9,
                color: m.tone,
                borderColor: 'color-mix(in oklab, ' + m.tone + ' 30%, var(--line))',
            }}
        >
            {m.mono}
        </div>
    )
}

// Compact pill-style select used in the OCR action bar
function PillSelect({
    value,
    options,
    leading,
    onChange,
    testId,
}: {
    value: string
    options: { value: string; label: string; mono?: string }[]
    leading?: React.ReactNode
    onChange?: (v: string) => void
    testId?: string
}): React.ReactElement {
    const [open, setOpen] = useState(false)
    const [coords, setCoords] = useState({ left: 0, top: 0, minWidth: 0, maxHeight: 240 })
    const triggerRef = useRef<HTMLButtonElement>(null)
    const popRef = useRef<HTMLDivElement>(null)
    const cur = options.find((o) => o.value === value)

    const measure = useCallback(() => {
        const trigger = triggerRef.current
        if (!trigger) return
        const rect = trigger.getBoundingClientRect()
        const pop_height = Math.min(240, options.length * 30 + 8)
        const top = rect.top > pop_height + 12 ? rect.top - pop_height - 4 : rect.bottom + 4
        setCoords({ left: rect.left, top, minWidth: rect.width, maxHeight: pop_height })
    }, [options.length])

    useEffect(() => {
        if (!open) return
        measure()
        const handle_scroll = () => { measure() }
        const handle_click = (event: MouseEvent) => {
            if (popRef.current?.contains(event.target as Node)) return
            if (triggerRef.current?.contains(event.target as Node)) return
            setOpen(false)
        }
        window.addEventListener('scroll', handle_scroll, true)
        window.addEventListener('resize', handle_scroll)
        document.addEventListener('mousedown', handle_click)
        return () => {
            window.removeEventListener('scroll', handle_scroll, true)
            window.removeEventListener('resize', handle_scroll)
            document.removeEventListener('mousedown', handle_click)
        }
    }, [open, measure])

    return (
        <>
            <button
                ref={triggerRef}
                data-testid={testId}
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen((o) => !o)
                }}
                style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 8,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--line)',
                    color: 'var(--text)',
                    fontSize: 12.5,
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                }}
            >
                {leading}
                <span>{cur?.label || value}</span>
                <Icons.Chev size={11} style={{ color: 'var(--text-mute)' }} />
            </button>
            {open && createPortal(
                <div
                    ref={popRef}
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                        minWidth: coords.minWidth,
                        maxHeight: coords.maxHeight,
                        overflowY: 'auto',
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                        padding: 4,
                        zIndex: 10000,
                    }}
                    onClick={(e) => { e.stopPropagation(); }}
                >
                    {options.map((o) => (
                        <div
                            key={o.value}
                            data-testid={testId ? `${testId}-option-${o.value}` : undefined}
                            onClick={() => {
                                onChange?.(o.value)
                                setOpen(false)
                            }}
                            style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                fontSize: 12.5,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                whiteSpace: 'nowrap',
                                background: o.value === value ? 'var(--brand-primary-soft)' : 'transparent',
                                color: o.value === value ? 'var(--brand-primary)' : 'var(--text)',
                            }}
                        >
                            {o.mono && <SvcTile name={o.mono} size={18} />}
                            <span>{o.label}</span>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </>
    )
}

// Export button with dropdown — generates real Word documents for .docx
function ExportButton({ text }: { text: string }): React.ReactElement {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (!open) return
        const close = () => { setOpen(false); }
        document.addEventListener('click', close)
        return () => { document.removeEventListener('click', close); }
    }, [open])

    const formats = [
        { value: 'md', label: 'Markdown', ext: '.md' },
        { value: 'txt', label: t('recognize.format_text'), ext: '.txt' },
        { value: 'docx', label: t('recognize.format_word_document'), ext: '.docx' },
        { value: 'doc', label: 'Word 97-2003', ext: '.doc' },
    ]

    const handle_export = async (fmt: string): Promise<void> => {
        const ext = formats.find((format) => format.value === fmt)?.ext ?? '.txt'
        let blob: Blob
        if (fmt === 'docx') {
            const { Document, Packer, Paragraph, TextRun } = await import('docx')
            const lines = text.split('\n')
            const doc = new Document({
                sections: [{
                    children: lines.map((line) =>
                        new Paragraph({ children: [new TextRun({ text: line, font: 'Calibri', size: 24 })] })
                    ),
                }],
            })
            const buffer = await Packer.toBlob(doc)
            blob = buffer
        } else {
            blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ocr_result${ext}`
        a.click()
        URL.revokeObjectURL(url)
        setOpen(false)
    }

    return (
        <div style={{ position: 'relative' }}>
            <button className="ic-btn" title={t('recognize.export')} data-testid="ocr-export-btn" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
                <Icons.Export size={16} />
            </button>
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 6px)',
                        right: 0,
                        minWidth: 160,
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                        padding: 4,
                        zIndex: 50,
                    }}
                    onClick={(e) => { e.stopPropagation(); }}
                >
                    <div style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        {t('recognize.export_format')}
                    </div>
                    {formats.map((f) => (
                        <div
                            key={f.value}
                            data-testid={`ocr-export-option-${f.value}`}
                            onClick={() => { handle_export(f.value).catch(console.error); }}
                            style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 12.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-sunk)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{ flex: 1 }}>{f.label}</span>
                            <span className="hint mono">{f.ext}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function RecognizeWindow(): React.ReactElement {
    const { t } = useTranslation()
    const [mode, setMode] = useState<'recognize' | 'translate'>('recognize')
    const [imageBase64, setImageBase64] = useState<string>('')
    const [recognizedText, setRecognizedText] = useState<string>('')
    const [translatedText, setTranslatedText] = useState<string>('')
    const [alwaysOnTop, setAlwaysOnTop] = useState(() => useConfigStore.getState().config.recognize_always_on_top)
    const [selectedService, setSelectedService] = useState<string>('')
    const [selectedLanguage, setSelectedLanguage] = useState<string>('auto')
    const [targetLanguage, setTargetLanguage] = useState<string>('')
    const [isRecognizing, setIsRecognizing] = useState(false)
    const [isTranslating, setIsTranslating] = useState(false)
    const [effectiveTargetLang, setEffectiveTargetLang] = useState<LanguageCode | null>(null)
    const [detectedSourceLang, setDetectedSourceLang] = useState<LanguageCode | null>(null)

    const config = useConfigStore((s) => s.config)
    const ocrRequestIdRef = useRef(0)

    const handleNormalizeText = useCallback((text: string): string => {
        return config.recognize_delete_newline ? normalize_recognized_text(text) : text
    }, [config.recognize_delete_newline])

    // Listen for new screenshots from main process
    useEffect(() => {
        const unsub = window.electronAPI.ocr.onRecognizeShow((base64, text, m) => {
            const next_text = handleNormalizeText(text)
            setImageBase64(base64)
            setRecognizedText(next_text)
            setTranslatedText('')
            setEffectiveTargetLang(null)
            setDetectedSourceLang(null)
            setMode(m === 'translate' ? 'translate' : 'recognize')
            if (config.recognize_auto_copy && next_text) {
                window.electronAPI.text.writeClipboard(next_text).catch(() => undefined)
            }
        })
        return unsub
    }, [config.recognize_auto_copy, handleNormalizeText])

    useEffect(() => {
        window.electronAPI.ready('recognize')
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') window.electronAPI.window.close().catch(console.error)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => { window.removeEventListener('keydown', handleKeyDown); }
    }, [])

    const service_instances = config.service_instances
    const service_list = config.recognize_service_list.filter((instance_key) => get_service_config(service_instances, instance_key).enable !== false)

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

    const effectiveService = selectedService && service_list.includes(selectedService) ? selectedService : service_list[0] || ''
    const effectiveServiceKey = effectiveService ? getServiceKey(effectiveService) : ''
    const effectiveMeta = effectiveServiceKey ? (OCR_META[effectiveServiceKey] ?? null) : null

    const effectiveTarget = targetLanguage || config.translate_target_language || 'zh_cn'

    // ---- Request ID guard for OCR ----
    const bumpOcrRequestId = useCallback((): number => {
        ocrRequestIdRef.current += 1
        return ocrRequestIdRef.current
    }, [])

    // Auto-re-recognize when OCR language or service changes in recognize mode
    useEffect(() => {
        if (mode !== 'recognize') return
        if (!imageBase64) return
        handleRecognize().catch(console.error)
    }, [selectedLanguage, effectiveService]) // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Translate (used in translate mode) ----
    const doTranslate = useCallback(async (text: string, sourceLang: LanguageCode, requestId: number): Promise<void> => {
        const translateServiceList = useConfigStore.getState().config.translate_service_list
        const svcInstances = useConfigStore.getState().config.service_instances
        const enabledList = translateServiceList.filter((ik) => get_service_config(svcInstances, ik).enable !== false)
        if (enabledList.length === 0) return

        const secondLanguage = useConfigStore.getState().config.translate_second_language

        let detectedSource: LanguageCode | null = null
        if (sourceLang === 'auto') {
            detectedSource = await detectLanguage(text, useConfigStore.getState().config.translate_detect_engine)
            if (ocrRequestIdRef.current !== requestId) return
        }
        setDetectedSourceLang(detectedSource)

        let effectiveTargetLangLocal = effectiveTarget as LanguageCode
        if (sourceLang === 'auto' && detectedSource && detectedSource === effectiveTargetLangLocal) {
            effectiveTargetLangLocal = (secondLanguage || 'en') as LanguageCode
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
                const translated = typeof result === 'string' ? result : result.definitions.map((d) => `${d.partOfSpeech ? `[${d.partOfSpeech}] ` : ''}${d.meanings.join('; ')}`).join('\n')
                setTranslatedText(translated)
            }
        } catch {
            // keep existing on failure
        }
    }, [effectiveTarget])

    // ---- OCR ----
    const handleRecognize = useCallback(async () => {
        if (!imageBase64) return
        const requestId = bumpOcrRequestId()
        setIsRecognizing(true)
        setTranslatedText('')

        const lang = (selectedLanguage || config.recognize_language) as LanguageCode
        const instance_key = effectiveService
        if (!instance_key) {
            setIsRecognizing(false)
            return
        }

        const svc_key = getServiceKey(instance_key)
        const service = ocrServiceRegistry.get(svc_key)
        if (!service) {
            setIsRecognizing(false)
            return
        }

        const instance_config: ServiceConfig = get_service_config(service_instances, instance_key)
        try {
            const result = await service.recognize(imageBase64, lang, instance_config)
            if (ocrRequestIdRef.current !== requestId) return
            const next_text = handleNormalizeText(result || '')
            setRecognizedText(next_text)
            if (config.recognize_auto_copy && next_text) {
                await window.electronAPI.text.writeClipboard(next_text).catch(() => undefined)
            }
            // Auto-translate in translate mode after OCR completes
            if (mode === 'translate' && next_text) {
                setIsTranslating(true)
                await doTranslate(next_text, lang, requestId)
                setIsTranslating(false)
            }
        } catch {
            // keep existing text on failure
        }
        if (ocrRequestIdRef.current === requestId) {
            setIsRecognizing(false)
        }
    }, [imageBase64, effectiveService, selectedLanguage, service_instances, config.recognize_language, config.recognize_auto_copy, mode, bumpOcrRequestId, handleNormalizeText, doTranslate])

    // Auto-re-translate when target language changes in translate mode
    useEffect(() => {
        if (mode !== 'translate') return
        if (!recognizedText) return
        const requestId = bumpOcrRequestId()
        setIsTranslating(true)
        doTranslate(recognizedText, (selectedLanguage || 'auto') as LanguageCode, requestId)
            .finally(() => { setIsTranslating(false); })
            .catch(console.error)
    }, [targetLanguage, effectiveTarget]) // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Handlers ----
    const handleCopy = useCallback(async () => {
        if (recognizedText) {
            await window.electronAPI.text.writeClipboard(recognizedText).catch(() => undefined)
        }
    }, [recognizedText])

    const handleTranslate = useCallback(async () => {
        setMode('translate')
        setTranslatedText('')
        if (!recognizedText) return
        const requestId = bumpOcrRequestId()
        setIsTranslating(true)
        await doTranslate(recognizedText, (selectedLanguage || 'auto') as LanguageCode, requestId)
        setIsTranslating(false)
    }, [recognizedText, selectedLanguage, bumpOcrRequestId, doTranslate])

    const handleDeleteNewline = useCallback(() => {
        setRecognizedText(normalize_recognized_text(recognizedText))
    }, [recognizedText])

    const handleDeleteAllSpaces = useCallback(() => {
        setRecognizedText(recognizedText.replace(/\s+/g, ''))
    }, [recognizedText])

    const handleClose = useCallback(() => {
        window.electronAPI.window.close().catch(console.error)
    }, [])

    const handleTogglePin = useCallback(() => {
        const next = !alwaysOnTop
        setAlwaysOnTop(next)
        window.electronAPI.window.setAlwaysOnTop(next)
            .then(() => { useConfigStore.getState().set('recognize_always_on_top', next) })
            .catch(console.error)
    }, [alwaysOnTop])

    const handleCopyImage = useCallback(async () => {
        if (!imageBase64) return
        try {
            const binary = atob(imageBase64)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
            const blob = new Blob([bytes], { type: 'image/png' })
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        } catch {
            // fallback: copy data URL as text
            await window.electronAPI.text.writeClipboard(`data:image/png;base64,${imageBase64}`).catch(() => undefined)
        }
    }, [imageBase64])

    const handleSwap = useCallback(() => {
        const src = selectedLanguage === 'auto' ? (selectedLanguage) : selectedLanguage
        const tgt = effectiveTarget
        setTargetLanguage(src === 'auto' ? tgt : src)
        if (src !== 'auto') {
            setSelectedLanguage(tgt)
        }
    }, [selectedLanguage, effectiveTarget])

    const is_translate_mode = mode === 'translate'
    const modeLabel = is_translate_mode ? t('recognize.translate') : t('recognize.title')

    return (
        <div className="op-window">
            {/* Titlebar */}
            <div className="op-titlebar">
                <div style={{ display: 'flex', gap: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                    <button
                        title={t('translate_settings.always_on_top')}
                        data-testid="titlebar-pin"
                        aria-pressed={alwaysOnTop}
                        onClick={handleTogglePin}
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 6,
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--brand-primary)',
                            background: 'transparent',
                            border: 0,
                            padding: 0,
                            WebkitAppRegion: 'no-drag' as const,
                            cursor: 'pointer'
                        } as React.CSSProperties}
                    >
                        <Icons.Pin size={25} fill={alwaysOnTop} />
                    </button>
                </div>
                <div className="op-wordmark" style={{ marginLeft: 2 }} data-testid="titlebar-wordmark">
                    Omni Pot
                </div>
                <span className="op-mode" data-testid="titlebar-mode">{modeLabel}</span>
                <div style={{ flex: 1 }} />
                <button className="op-close" title={t('close')} data-testid="titlebar-close" onClick={handleClose}>
                    <Icons.Close size={18} />
                </button>
            </div>

            {/* Dual-pane: image | text */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0, gap: 10, padding: '4px 10px 8px' }}>
                {/* Image card */}
                <div className="card" style={{ padding: 6, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div
                        data-testid="ocr-image"
                        style={{
                            flex: 1,
                            borderRadius: 7,
                            background: 'var(--bg-sunk)',
                            border: '1px solid var(--line)',
                            overflow: 'hidden',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {imageBase64 ? (
                            <img
                                src={`data:image/png;base64,${imageBase64}`}
                                alt="captured"
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-mute)', fontSize: 13 }}>
                                <Icons.Image size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                                <div>{t('recognize.waiting_screenshot')}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column: single card (recognize) or dual cards (translate) */}
                {is_translate_mode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8 }}>
                        {/* Recognized text card */}
                        <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '6px 14px 0', fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                                {detectedSourceLang ? `${native_language_name(t, detectedSourceLang)}${t('of_separator', { defaultValue: '的' })}${t('recognize.title')}` : t('recognize.title')}
                            </div>
                            <textarea
                                data-testid="ocr-text"
                                value={recognizedText}
                                onChange={(e) => { setRecognizedText(e.target.value); }}
                                placeholder={isRecognizing ? t('recognize.recognizing') : t('recognize.result_placeholder')}
                                style={{
                                    flex: 1,
                                    padding: '8px 14px 12px',
                                    fontSize: 13.5,
                                    lineHeight: 1.65,
                                    color: 'var(--text)',
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    resize: 'none',
                                    fontFamily: 'inherit',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                }}
                            />
                        </div>
                        {/* Translation result card */}
                        <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '6px 14px 0', fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                                {detectedSourceLang ? `${native_language_name(t, (effectiveTargetLang ?? effectiveTarget) as LanguageCode)}${t('of_separator', { defaultValue: '的' })}${t('translate')}` : t('translate')}
                            </div>
                            <div
                                data-testid="ocr-translation"
                                style={{
                                    flex: 1,
                                    padding: '8px 14px 12px',
                                    fontSize: 13.5,
                                    lineHeight: 1.65,
                                    color: 'var(--text)',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {isTranslating && !translatedText ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                                        <div className="shimmer" style={{ height: 13, width: '70%' }} />
                                        <div className="shimmer" style={{ height: 13, width: '90%' }} />
                                        <div className="shimmer" style={{ height: 13, width: '50%' }} />
                                    </div>
                                ) : translatedText || null}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                        <textarea
                            data-testid="ocr-text"
                            value={recognizedText}
                            onChange={(e) => { setRecognizedText(e.target.value); }}
                            placeholder={isRecognizing ? t('recognize.recognizing') : t('recognize.result_placeholder')}
                            style={{
                                flex: 1,
                                padding: '12px 14px',
                                fontSize: 13.5,
                                lineHeight: 1.65,
                                color: 'var(--text)',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                resize: 'none',
                                fontFamily: 'inherit',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}
                        />
                    </div>
                )}
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
                <button className="ic-btn" title={t('recognize.copy_image', { defaultValue: '复制图片' })} data-testid="ocr-copy-image-btn" onClick={() => { handleCopyImage().catch(console.error); }} disabled={!imageBase64}>
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
                            onChange={setTargetLanguage}
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
                        onClick={() => { handleTranslate().catch(console.error); }}
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
                <button className="ic-btn" title={t('copy')} data-testid="ocr-copy-btn" onClick={() => { handleCopy().catch(console.error); }} disabled={!recognizedText}>
                    <Icons.Copy size={16} />
                </button>
                <ExportButton text={is_translate_mode ? translatedText : recognizedText} />
            </div>

            {/* Spin animation for recognizing state */}
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}
