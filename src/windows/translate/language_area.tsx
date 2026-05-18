import React from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useTranslateStore } from '../../stores/translate_store'
import { native_language_name } from '../../i18n/language_names'
import { LANGUAGE_CODES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'

const SOURCE_LANGUAGES: LanguageCode[] = ['auto', ...LANGUAGE_CODES.filter((c) => c !== 'auto')]
const TARGET_LANGUAGES: LanguageCode[] = LANGUAGE_CODES.filter((c) => c !== 'auto')

function LangPick({ value, onChange, options, testId, optionTestIdPrefix }: {
    value: LanguageCode
    onChange: (v: LanguageCode) => void
    options: string[]
    testId: string
    optionTestIdPrefix: string
}): React.ReactElement {
    const { t } = useTranslation()
    const [open, setOpen] = React.useState(false)
    const POP_W = 180
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const popRef = React.useRef<HTMLDivElement>(null)
    const [coords, setCoords] = React.useState({ left: 0, top: 0, maxH: 280 })

    const measure = React.useCallback(() => {
        const el = triggerRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const popH = Math.min(320, options.length * 30 + 8)
        const spaceBelow = window.innerHeight - r.bottom
        const above = spaceBelow < popH + 12 && r.top > popH + 12
        // Center horizontally under the trigger.
        const wantLeft = r.left + r.width / 2 - POP_W / 2
        const left = Math.min(Math.max(8, wantLeft), window.innerWidth - POP_W - 8)
        setCoords({
            left,
            top: above ? r.top - popH - 6 : r.bottom + 6,
            maxH: popH
        })
    }, [options.length])

    const toggle_open = () => {
        setOpen((o) => !o)
    }

    React.useEffect(() => {
        if (!open) return
        measure()
        const onScroll = () => { measure() }
        const handleClickOutside = (e: MouseEvent) => {
            if (popRef.current?.contains(e.target as Node)) return
            if (triggerRef.current?.contains(e.target as Node)) return
            setOpen(false)
        }
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            window.removeEventListener('scroll', onScroll, true)
            window.removeEventListener('resize', onScroll)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [open, measure])

    return (
        <React.Fragment>
            <button
                ref={triggerRef}
                data-testid={testId}
                onClick={(e) => { e.stopPropagation(); toggle_open() }}
                style={{
                    height: 28,
                    padding: '0 6px',
                    background: open ? 'var(--brand-primary-soft)' : 'transparent',
                    border: 0,
                    borderRadius: 6,
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
                {native_language_name(t, value)}
                <Icons.Chev size={12} style={{ color: 'var(--text-mute)', marginTop: 1, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {open && createPortal(
                <div
                    ref={popRef}
                    onMouseDown={(e) => { e.stopPropagation(); }}
                    style={{
                    position: 'fixed',
                    top: coords.top,
                    left: coords.left,
                    width: POP_W,
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)',
                    boxShadow: '0 10px 28px rgba(0,0,0,0.14)',
                    padding: 4,
                    zIndex: 10000,
                    maxHeight: coords.maxH,
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
                            {native_language_name(t, code as LanguageCode)}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </React.Fragment>
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
    const detectedLanguage = useTranslateStore((s) => s.detectedLanguage)
    const autoNoDetect = sourceLanguage === 'auto' && !detectedLanguage

    return (
        <div className="card" style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flex: '0 0 auto' }}>
            <div data-testid="lang-source">
                <LangPick value={sourceLanguage} onChange={setSourceLanguage} options={SOURCE_LANGUAGES} testId="lang-source-button" optionTestIdPrefix="lang-source-option" />
            </div>
            <button className="ic-btn" style={{ color: autoNoDetect ? 'var(--text-mute)' : 'var(--text)', cursor: autoNoDetect ? 'not-allowed' : 'pointer' }} title={autoNoDetect ? t('auto_detect_no_swap') : t('swap_languages')} data-testid="lang-swap" onClick={onSwap} disabled={autoNoDetect}>
                <Icons.Swap size={18} />
            </button>
            <div data-testid="lang-target">
                <LangPick value={effectiveTargetLanguage ?? targetLanguage} onChange={setTargetLanguage} options={TARGET_LANGUAGES} testId="lang-target-button" optionTestIdPrefix="lang-target-option" />
            </div>
        </div>
    )
}
