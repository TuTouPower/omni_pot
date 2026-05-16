import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfigStore } from '../../stores/config_store'
import { ocrServiceRegistry } from '../../services/registry'
import { language_name } from '../../i18n/language_names'
import { getServiceKey } from '@shared/types/service'
import { LANGUAGE_CODES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'

function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

// OCR engine metadata (subset of SVC_META for action bar)
const OCR_META: Record<string, { name: string; mono: string; tone: string }> = {
    system: { name: '系统 OCR', mono: 'SY', tone: 'oklch(54% 0.005 70)' },
    tesseract: { name: 'Tesseract', mono: 'TE', tone: 'oklch(58% 0.10 50)' },
    openai_compatible: { name: 'AI 视觉', mono: 'VL', tone: 'oklch(58% 0.02 180)' },
    baidu_accurate_ocr: { name: '百度高精度', mono: 'BA', tone: 'oklch(58% 0.16 250)' },
    baidu_ocr: { name: '百度 OCR', mono: 'BD', tone: 'oklch(58% 0.16 250)' },
    tencent_ocr: { name: '腾讯 OCR', mono: 'TC', tone: 'oklch(60% 0.13 230)' },
    iflytek_ocr: { name: '讯飞 OCR', mono: 'IF', tone: 'oklch(60% 0.13 220)' },
    iflytek_latex_ocr: { name: '讯飞 LaTeX', mono: 'TX', tone: 'oklch(60% 0.13 220)' },
    qrcode: { name: '二维码', mono: 'QR', tone: 'oklch(50% 0.01 70)' },
}

function normalize_recognized_text(text: string): string {
    return text.replace(/-\s+/g, '').replace(/\s+/g, ' ')
}

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
    const cur = options.find((o) => o.value === value)

    useEffect(() => {
        if (!open) return
        const close = () => { setOpen(false); }
        document.addEventListener('click', close)
        return () => { document.removeEventListener('click', close); }
    }, [open])

    return (
        <div style={{ position: 'relative' }}>
            <button
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
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 4px)',
                        left: 0,
                        minWidth: '100%',
                        maxHeight: 240,
                        overflowY: 'auto',
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                        padding: 4,
                        zIndex: 50,
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
                </div>
            )}
        </div>
    )
}

// Pill-style button — same dimensions as PillSelect, no chevron
function PillButton({
    icon,
    label,
    onClick,
    testId,
}: {
    icon: React.ReactNode
    label: string
    onClick?: () => void
    testId?: string
}): React.ReactElement {
    return (
        <button
            data-testid={testId}
            onClick={onClick}
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
            {icon}
            <span>{label}</span>
        </button>
    )
}

// Export button with dropdown
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

    const handle_export = (fmt: string): void => {
        const ext = formats.find((format) => format.value === fmt)?.ext ?? '.txt'
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
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
                            onClick={() => { handle_export(f.value); }}
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
    const [imageBase64, setImageBase64] = useState<string>('')
    const [recognizedText, setRecognizedText] = useState<string>('')
    const [alwaysOnTop, setAlwaysOnTop] = useState(false)
    const [selectedService, setSelectedService] = useState<string>('')
    const [selectedLanguage, setSelectedLanguage] = useState<string>('auto')
    const [isRecognizing, setIsRecognizing] = useState(false)

    const config = useConfigStore((s) => s.config)

    useEffect(() => {
        const unsub = window.electronAPI.ocr.onRecognizeShow((base64, text) => {
            const next_text = config.recognize_delete_newline ? normalize_recognized_text(text) : text
            setImageBase64(base64)
            setRecognizedText(next_text)
            if (config.recognize_auto_copy && next_text) {
                window.electronAPI.text.writeClipboard(next_text).catch(() => undefined)
            }
        })
        return unsub
    }, [config.recognize_auto_copy, config.recognize_delete_newline])

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
            label: svc?.name ?? svcKey,
            mono: svcKey,
        }
    })

    // Build language options
    const lang_options = LANGUAGE_CODES.map((code) => ({
        value: code,
        label: language_name(t, code),
    }))

    const effectiveService = selectedService && service_list.includes(selectedService) ? selectedService : service_list[0] || ''
    const effectiveServiceKey = effectiveService ? getServiceKey(effectiveService) : ''
    const effectiveMeta = effectiveServiceKey ? (OCR_META[effectiveServiceKey] ?? null) : null

    const handleRecognize = useCallback(async () => {
        if (!imageBase64) return
        setIsRecognizing(true)

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
            const next_text = config.recognize_delete_newline ? normalize_recognized_text(result || '') : result || ''
            setRecognizedText(next_text)
            if (config.recognize_auto_copy && next_text) {
                await window.electronAPI.text.writeClipboard(next_text).catch(() => undefined)
            }
        } catch {
            // keep existing text on failure
        }
        setIsRecognizing(false)
    }, [imageBase64, effectiveService, selectedLanguage, service_instances, config.recognize_language, config.recognize_auto_copy, config.recognize_delete_newline])

    const handleCopy = useCallback(async () => {
        if (recognizedText) {
            await window.electronAPI.text.writeClipboard(recognizedText).catch(() => undefined)
        }
    }, [recognizedText])

    const handleTranslate = useCallback(async () => {
        if (recognizedText) {
            await window.electronAPI.ocr.sendToTranslate(recognizedText)
        }
    }, [recognizedText])

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
        window.electronAPI.window.setAlwaysOnTop(next).catch(console.error)
    }, [alwaysOnTop])

    return (
        <div className="op-window">
            {/* Titlebar */}
            <div className="op-titlebar">
                <button
                    className="ic-btn"
                    title={t('pin')}
                    data-testid="titlebar-pin"
                    onClick={handleTogglePin}
                    style={{ color: alwaysOnTop ? 'var(--brand-primary)' : 'var(--text-mute)' }}
                >
                    <Icons.Pin size={14} fill={alwaysOnTop} />
                </button>
                <div className="op-wordmark" style={{ marginLeft: 2 }} data-testid="titlebar-wordmark">
                    Omni Pot
                </div>
                <span className="op-mode" data-testid="titlebar-mode">{t('recognize.title')}</span>
                <div style={{ flex: 1 }} />
                <button className="ic-btn" title={t('close')} data-testid="titlebar-close" onClick={handleClose}>
                    <Icons.Close size={14} />
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

                {/* Text card */}
                <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                    <textarea
                        data-testid="ocr-text"
                        value={recognizedText}
                        onChange={(e) => { setRecognizedText(e.target.value); }}
                        placeholder={t('recognize.result_placeholder')}
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
            </div>

            {/* Action bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px 10px',
                borderTop: '1px solid var(--line)',
            }}>
                {ocr_engine_options.length > 0 && (
                    <PillSelect
                        value={effectiveService}
                        options={ocr_engine_options}
                        leading={effectiveMeta ? <SvcTile name={effectiveServiceKey} size={18} /> : undefined}
                        onChange={setSelectedService}
                        testId="ocr-engine-select"
                    />
                )}
                <PillSelect
                    value={selectedLanguage}
                    options={lang_options}
                    leading={<Icons.Globe size={13} style={{ color: 'var(--text-mute)' }} />}
                    onChange={setSelectedLanguage}
                    testId="ocr-lang-select"
                />
                <PillButton
                    icon={isRecognizing ? (
                        <Icons.Cycle size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                        <Icons.Cycle size={14} />
                    )}
                    label={isRecognizing ? t('recognize.recognizing') : t('recognize.re_recognize')}
                    onClick={() => { handleRecognize().catch(console.error); }}
                    testId="ocr-reocr-btn"
                />

                <div style={{ flex: 1 }} />

                <button className="ic-btn" title={t('recognize.delete_newline')} data-testid="ocr-newline-btn" onClick={handleDeleteNewline} disabled={!recognizedText}>
                    <Icons.Newline size={16} />
                </button>
                <button className="ic-btn" title={t('recognize.delete_spaces')} data-testid="ocr-space-btn" onClick={handleDeleteAllSpaces} disabled={!recognizedText}>
                    <Icons.Hash size={16} />
                </button>
                <button className="ic-btn" title={t('copy')} data-testid="ocr-copy-btn" onClick={() => { handleCopy().catch(console.error); }} disabled={!recognizedText}>
                    <Icons.Copy size={16} />
                </button>
                <ExportButton text={recognizedText} />
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
            </div>

            {/* Spin animation for recognizing state */}
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}
