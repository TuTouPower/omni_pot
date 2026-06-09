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

const LangPick = React.memo(function LangPick({ value, onChange, options, testId, optionTestIdPrefix }: {
    value: LanguageCode
    onChange: (v: LanguageCode) => void
    options: string[]
    testId: string
    optionTestIdPrefix: string
}): React.ReactElement {
    const { t } = useTranslation()
    const [open, setOpen] = React.useState(false)
    const [active_index, setActiveIndex] = React.useState(0)
    const POP_W = 180
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const popRef = React.useRef<HTMLDivElement>(null)
    const [coords, setCoords] = React.useState({ left: 0, top: 0, maxH: 280 })
    const selected_index = Math.max(0, options.indexOf(value))
    const listbox_id = `${testId}-listbox`
    const active_code = options[active_index]
    const active_id = active_code ? `${optionTestIdPrefix}-${active_code}` : undefined

    const measure = React.useCallback(() => {
        const el = triggerRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const popH = Math.min(320, options.length * 30 + 8)
        const spaceBelow = window.innerHeight - r.bottom
        const above = spaceBelow < popH + 12 && r.top > popH + 12
        const wantLeft = r.left + r.width / 2 - POP_W / 2
        const left = Math.min(Math.max(8, wantLeft), window.innerWidth - POP_W - 8)
        setCoords({
            left,
            top: above ? r.top - popH - 6 : r.bottom + 6,
            maxH: popH
        })
    }, [options.length])

    const open_menu = React.useCallback((index = selected_index) => {
        setActiveIndex(index)
        setOpen(true)
    }, [selected_index])

    const select_code = React.useCallback((code: string) => {
        onChange(code as LanguageCode)
        setOpen(false)
        triggerRef.current?.focus()
    }, [onChange])

    const move_active = React.useCallback((delta: number) => {
        setActiveIndex((index) => (index + delta + options.length) % options.length)
    }, [options.length])

    const handle_key_down = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!open) open_menu()
            else move_active(1)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) open_menu()
            else move_active(-1)
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!open) open_menu()
            else if (active_code) select_code(active_code)
        } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
        }
    }, [active_code, move_active, open, open_menu, select_code])

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

    React.useEffect(() => {
        if (!open || !active_id) return
        document.getElementById(active_id)?.scrollIntoView({ block: 'nearest' })
    }, [active_id, open])

    return (
        <React.Fragment>
            <button
                ref={triggerRef}
                data-testid={testId}
                role="combobox"
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={open ? listbox_id : undefined}
                aria-activedescendant={open ? active_id : undefined}
                onClick={(e) => {
                    e.stopPropagation()
                    if (open) setOpen(false)
                    else open_menu()
                }}
                onKeyDown={handle_key_down}
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
                    id={listbox_id}
                    ref={popRef}
                    role="listbox"
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
                    {options.map((code, index) => {
                        const selected = code === value
                        const active = index === active_index
                        return (
                            <div
                                key={code}
                                id={`${optionTestIdPrefix}-${code}`}
                                role="option"
                                aria-selected={selected}
                                data-testid={`${optionTestIdPrefix}-${code}`}
                                onClick={() => { select_code(code) }}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: selected ? 'var(--brand-primary-soft)' : active ? 'var(--bg-sunk)' : 'transparent',
                                    color: selected ? 'var(--brand-primary)' : 'var(--text)',
                                    fontSize: 13,
                                }}
                                onMouseEnter={() => { setActiveIndex(index) }}
                            >
                                {native_language_name(t, code as LanguageCode)}
                            </div>
                        )
                    })}
                </div>,
                document.body
            )}
        </React.Fragment>
    )
})

interface LanguageAreaProps {
    onSwap: () => void
    containerRef?: React.Ref<HTMLDivElement>
}

const LanguageArea_ = function LanguageArea({ onSwap, containerRef }: LanguageAreaProps): React.ReactElement {
    const { t } = useTranslation()
    const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
    const targetLanguage = useTranslateStore((s) => s.targetLanguage)
    const effectiveTargetLanguage = useTranslateStore((s) => s.effectiveTargetLanguage)
    const setSourceLanguage = useTranslateStore((s) => s.setSourceLanguage)
    const setTargetLanguage = useTranslateStore((s) => s.setTargetLanguage)
    const setLockedTargetLanguage = useTranslateStore((s) => s.setLockedTargetLanguage)
    const detectedLanguage = useTranslateStore((s) => s.detectedLanguage)
    const autoNoDetect = sourceLanguage === 'auto' && !detectedLanguage

    return (
        <div ref={containerRef} className="card" style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flex: '0 0 auto' }}>
            <div data-testid="lang-source">
                <LangPick value={sourceLanguage} onChange={setSourceLanguage} options={SOURCE_LANGUAGES} testId="lang-source-button" optionTestIdPrefix="lang-source-option" />
            </div>
            <button className="ic-btn" style={{ color: autoNoDetect ? 'var(--text-mute)' : 'var(--text)', cursor: autoNoDetect ? 'not-allowed' : 'pointer' }} title={autoNoDetect ? t('auto_detect_no_swap') : t('swap_languages')} data-testid="lang-swap" onClick={onSwap} disabled={autoNoDetect}>
                <Icons.Swap size={18} />
            </button>
            <div data-testid="lang-target">
                <LangPick value={effectiveTargetLanguage ?? targetLanguage} onChange={(lang) => { setTargetLanguage(lang); setLockedTargetLanguage(lang); }} options={TARGET_LANGUAGES} testId="lang-target-button" optionTestIdPrefix="lang-target-option" />
            </div>
        </div>
    )
}
export const LanguageArea = React.memo(LanguageArea_)
