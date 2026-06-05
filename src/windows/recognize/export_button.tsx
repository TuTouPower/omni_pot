import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { log_error } from './recognize_helpers'

export function ExportButton({ text }: { text: string }): React.ReactElement {
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
                            onClick={() => { handle_export(f.value).catch((err: unknown) => { log_error('export recognized text', err) }); }}
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
