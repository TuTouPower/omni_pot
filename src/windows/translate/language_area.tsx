import React from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useTranslateStore } from '../../stores/translate_store'
import { language_name } from '../../i18n/language_names'
import { LANGUAGE_CODES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'

const SOURCE_LANGUAGES = ['auto', ...LANGUAGE_CODES.filter((c) => c !== 'auto')]
const TARGET_LANGUAGES = LANGUAGE_CODES.filter((c) => c !== 'auto')

function LangPick({ value, onChange, options, testId, optionTestIdPrefix }: {
    value: LanguageCode
    onChange: (v: LanguageCode) => void
    options: string[]
    testId: string
    optionTestIdPrefix: string
}): React.ReactElement {
    const { t } = useTranslation()
    const [open, setOpen] = React.useState(false)
    const [menuRect, setMenuRect] = React.useState<{ top: number; left: number; width: number } | null>(null)
    const ref = React.useRef<HTMLDivElement>(null)

    const toggle_open = () => {
        const rect = ref.current?.getBoundingClientRect()
        if (rect) setMenuRect({ top: rect.bottom + 4, left: rect.left, width: Math.max(140, rect.width) })
        setOpen((o) => !o)
    }

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => { document.removeEventListener('mousedown', handleClickOutside); }
    }, [])

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                data-testid={testId}
                onClick={toggle_open}
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
                {language_name(t, value)}
                <Icons.Chev size={12} style={{ color: 'var(--text-mute)', marginTop: 1 }} />
            </button>
            {open && menuRect && createPortal(
                <div
                    onMouseDown={(e) => { e.stopPropagation(); }}
                    style={{
                    position: 'fixed',
                    top: menuRect.top,
                    left: menuRect.left,
                    minWidth: menuRect.width,
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                    padding: 4,
                    zIndex: 1000,
                    maxHeight: 280,
                    overflowY: 'auto',
                }}>
                    {options.map((code) => (
                        <div
                            key={code}
                            data-testid={`${optionTestIdPrefix}-${code}`}
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
                            {language_name(t, code as LanguageCode)}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    )
}

interface LanguageAreaProps {
    onSwap: () => void
}

export function LanguageArea({ onSwap }: LanguageAreaProps): React.ReactElement {
    const { t } = useTranslation()
    const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
    const targetLanguage = useTranslateStore((s) => s.targetLanguage)
    const effectiveTargetLanguage = useTranslateStore((s) => s.effectiveTargetLanguage)
    const setSourceLanguage = useTranslateStore((s) => s.setSourceLanguage)
    const setTargetLanguage = useTranslateStore((s) => s.setTargetLanguage)

    return (
        <div className="card" style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flex: '0 0 auto' }}>
            <div data-testid="lang-source">
                <LangPick value={sourceLanguage} onChange={setSourceLanguage} options={SOURCE_LANGUAGES} testId="lang-source-button" optionTestIdPrefix="lang-source-option" />
            </div>
            <button className="ic-btn" style={{ color: 'var(--text)' }} title={t('swap_languages')} data-testid="lang-swap" onClick={onSwap}>
                <Icons.Swap size={18} />
            </button>
            <div data-testid="lang-target">
                <LangPick value={effectiveTargetLanguage ?? targetLanguage} onChange={setTargetLanguage} options={TARGET_LANGUAGES} testId="lang-target-button" optionTestIdPrefix="lang-target-option" />
            </div>
        </div>
    )
}
