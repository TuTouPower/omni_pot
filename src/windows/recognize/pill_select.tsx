import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icons } from '../../components/icons'
import { SvcTile } from '../../components/svc_tile'

export { SvcTile }

function require_pill_option<T>(options: T[], index: number): T {
    const option = options[index] ?? options[0]
    if (option === undefined) throw new Error('select requires options')
    return option
}

// OCR engine metadata (subset of SVC_META for action bar)
export const OCR_META: Partial<Record<string, { name: string; mono: string; tone: string }>> = {
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

export function PillSelect({
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
    const [active_index, setActiveIndex] = useState(0)
    const [coords, setCoords] = useState({ left: 0, top: 0, minWidth: 0, maxHeight: 240 })
    const triggerRef = useRef<HTMLButtonElement>(null)
    const popRef = useRef<HTMLDivElement>(null)
    const open_ref = useRef(open)
    const active_index_ref = useRef(active_index)
    open_ref.current = open
    active_index_ref.current = active_index
    const cur = options.find((o) => o.value === value)
    const selected_index = Math.max(0, options.findIndex((o) => o.value === value))
    const listbox_id = `${testId ?? 'pill-select'}-listbox`
    const active_option = require_pill_option(options, active_index)
    const active_id = `${listbox_id}-option-${active_option.value}`

    const measure = useCallback(() => {
        const trigger = triggerRef.current
        if (!trigger) return
        const rect = trigger.getBoundingClientRect()
        const pop_height = Math.min(240, options.length * 30 + 8)
        const top = rect.top > pop_height + 12 ? rect.top - pop_height - 4 : rect.bottom + 4
        setCoords({ left: rect.left, top, minWidth: rect.width, maxHeight: pop_height })
    }, [options.length])

    const open_menu = useCallback((index = selected_index) => {
        setActiveIndex(index)
        setOpen(true)
        triggerRef.current?.focus()
    }, [selected_index])

    const select_option = useCallback((option_value: string) => {
        onChange?.(option_value)
        setOpen(false)
        triggerRef.current?.focus()
    }, [onChange])

    const move_active = useCallback((delta: number) => {
        setActiveIndex((index) => (index + delta + options.length) % options.length)
    }, [options.length])

    const handle_key_down = useCallback((event: React.KeyboardEvent) => {
        const is_open = open_ref.current
        if (event.key === 'ArrowDown' || event.key === 'Down') {
            event.preventDefault()
            if (!is_open) open_menu()
            else move_active(1)
        } else if (event.key === 'ArrowUp' || event.key === 'Up') {
            event.preventDefault()
            if (!is_open) open_menu()
            else move_active(-1)
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!is_open) open_menu()
            else select_option(require_pill_option(options, active_index_ref.current).value)
        } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
        }
    }, [move_active, open_menu, options, select_option])

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

    useEffect(() => {
        if (!open) return
        document.getElementById(active_id)?.scrollIntoView({ block: 'nearest' })
    }, [active_id, open])

    return (
        <>
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
                onKeyDownCapture={handle_key_down}
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
                    id={listbox_id}
                    ref={popRef}
                    role="listbox"
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
                    {options.map((o, index) => {
                        const selected = o.value === value
                        const active = index === active_index
                        return (
                            <div
                                key={o.value}
                                id={`${listbox_id}-option-${o.value}`}
                                role="option"
                                aria-selected={selected}
                                data-testid={testId ? `${testId}-option-${o.value}` : undefined}
                                onClick={() => { select_option(o.value) }}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    fontSize: 12.5,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    whiteSpace: 'nowrap',
                                    background: selected ? 'var(--brand-primary-soft)' : active ? 'var(--bg-sunk)' : 'transparent',
                                    color: selected ? 'var(--brand-primary)' : 'var(--text)',
                                }}
                                onMouseMove={() => { setActiveIndex(index) }}
                            >
                                {o.mono && <SvcTile name={o.mono} size={18} />}
                                <span>{o.label}</span>
                            </div>
                        )
                    })}
                </div>,
                document.body
            )}
        </>
    )
}
