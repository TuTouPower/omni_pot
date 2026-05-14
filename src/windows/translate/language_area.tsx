import React from 'react'
import { Icons } from '../../components/icons'
import { useTranslateStore } from '../../stores/translate_store'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'

const SOURCE_LANGUAGES = ['auto', ...LANGUAGE_CODES.filter((c) => c !== 'auto')]
const TARGET_LANGUAGES = LANGUAGE_CODES.filter((c) => c !== 'auto')

function LangPick({ value, onChange, options }: {
    value: LanguageCode
    onChange: (v: LanguageCode) => void
    options: string[]
}): React.ReactElement {
    const [open, setOpen] = React.useState(false)
    const ref = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen((o) => !o)}
                style={{
                    height: 28,
                    padding: '0 6px',
                    background: 'transparent',
                    border: 0,
                    color: 'var(--text)',
                    fontSize: 13.5,
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                }}
            >
                {LANGUAGE_NAMES[value] || value}
                <Icons.Chev size={12} style={{ color: 'var(--text-mute)', marginTop: 1 }} />
            </button>
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    minWidth: 140,
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                    padding: 4,
                    zIndex: 50,
                    maxHeight: 280,
                    overflowY: 'auto',
                }}>
                    {options.map((code) => (
                        <div
                            key={code}
                            onClick={() => {
                                onChange(code as LanguageCode)
                                setOpen(false)
                            }}
                            style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: code === value ? 'var(--brand-primary-soft)' : 'transparent',
                                color: code === value ? 'var(--brand-primary)' : 'var(--text)',
                                fontSize: 13,
                            }}
                            onMouseEnter={(e) => {
                                if (code !== value) e.currentTarget.style.background = 'var(--bg-sunk)'
                            }}
                            onMouseLeave={(e) => {
                                if (code !== value) e.currentTarget.style.background = 'transparent'
                            }}
                        >
                            {LANGUAGE_NAMES[code as LanguageCode] || code}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export function LanguageArea(): React.ReactElement {
    const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
    const targetLanguage = useTranslateStore((s) => s.targetLanguage)
    const setSourceLanguage = useTranslateStore((s) => s.setSourceLanguage)
    const setTargetLanguage = useTranslateStore((s) => s.setTargetLanguage)
    const swapLanguages = useTranslateStore((s) => s.swapLanguages)

    return (
        <div className="card" style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flex: '0 0 auto' }}>
            <LangPick value={sourceLanguage} onChange={setSourceLanguage} options={SOURCE_LANGUAGES} />
            <button className="ic-btn" style={{ color: 'var(--text)' }} title="交换语言" onClick={swapLanguages}>
                <Icons.Swap size={18} />
            </button>
            <LangPick value={targetLanguage} onChange={setTargetLanguage} options={TARGET_LANGUAGES} />
        </div>
    )
}
