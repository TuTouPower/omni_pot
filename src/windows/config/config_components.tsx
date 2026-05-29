import React from 'react'
import { createPortal } from 'react-dom'

// Shared Card + Row components for config pages (matches design spec)

export function ConfigCard({ title, hint, children }: {
    title: string
    hint?: string
    children: React.ReactNode
}): React.ReactElement {
    return (
        <div className="card">
            <div className="card-head">
                <span>{title}</span>
                {hint && (
                    <span className="hint mono" style={{ textTransform: 'none', letterSpacing: 0, marginLeft: 'auto', fontWeight: 400 }}>
                        {hint}
                    </span>
                )}
            </div>
            <div className="card-body">{children}</div>
        </div>
    )
}

export function ConfigRow({ label, sub, help, children, testId }: {
    label: string
    sub?: string
    help?: { href?: string; title?: string }
    children?: React.ReactNode
    testId?: string
}): React.ReactElement {
    return (
        <div className="row" data-testid={testId} style={{ minHeight: 36 }}>
            <div className="label">
                {label}
                {help && (
                    <a
                        href={help.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={help.title}
                        className="label-help"
                    >?</a>
                )}
                {sub && <span className="sub">{sub}</span>}
            </div>
            {children}
        </div>
    )
}

export function ConfigSwitch({ on, onChange, testId }: {
    on: boolean
    onChange?: (v: boolean) => void
    testId?: string
}): React.ReactElement {
    return (
        <div
            data-testid={testId}
            role="switch"
            aria-checked={on}
            tabIndex={0}
            className={'switch' + (on ? ' on' : '')}
            onClick={() => onChange?.(!on)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onChange?.(!on)
                }
            }}
        />
    )
}

function require_select_option<T>(options: T[], index: number): T {
    const option = options[index] ?? options[0]
    if (option === undefined) return undefined as T
    return option
}

export function ConfigSelect<T extends string>({ value, onChange, options, style, testId }: {
    value: T
    onChange?: (v: T) => void
    options: { value: T; label: string }[]
    style?: React.CSSProperties
    testId?: string
}): React.ReactElement {
    const [open, setOpen] = React.useState(false)
    const [active_index, setActiveIndex] = React.useState(0)
    const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({})
    const ref = React.useRef<HTMLDivElement>(null)
    const menuRef = React.useRef<HTMLDivElement>(null)
    const cur = options.find((o) => o.value === value)
    const selected_index = Math.max(0, options.findIndex((o) => o.value === value))
    const listbox_id = `${testId ?? 'config-select'}-listbox`
    const active_option = require_select_option(options, active_index)
    const active_id = active_option ? `${listbox_id}-option-${active_option.value}` : undefined

    const updateMenuPosition = React.useCallback(() => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        const menuHeight = Math.min(280, options.length * 31 + 8)
        const opensDown = rect.bottom + 4 + menuHeight <= window.innerHeight
        setMenuStyle({
            position: 'fixed',
            top: opensDown ? rect.bottom + 4 : Math.max(4, rect.top - menuHeight - 4),
            left: rect.left,
            minWidth: rect.width,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
            padding: 4,
            zIndex: 2000,
            maxHeight: 280,
            overflowY: 'auto',
        })
    }, [options.length])

    const open_menu = React.useCallback((index = selected_index) => {
        setActiveIndex(index)
        setOpen(true)
    }, [selected_index])

    const select_option = React.useCallback((option_value: T) => {
        onChange?.(option_value)
        setOpen(false)
        ref.current?.focus()
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
            else select_option(active_option.value)
        } else if (e.key === 'Escape') {
            e.preventDefault()
            setOpen(false)
        }
    }, [active_option, move_active, open, open_menu, select_option])

    React.useLayoutEffect(() => {
        if (open) updateMenuPosition()
    }, [open, updateMenuPosition])

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node
            if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => { document.removeEventListener('mousedown', handleClickOutside); }
    }, [])

    React.useEffect(() => {
        if (!open) return
        window.addEventListener('resize', updateMenuPosition)
        document.addEventListener('scroll', updateMenuPosition, true)
        return () => {
            window.removeEventListener('resize', updateMenuPosition)
            document.removeEventListener('scroll', updateMenuPosition, true)
        }
    }, [open, updateMenuPosition])

    React.useEffect(() => {
        if (!open || !active_id) return
        document.getElementById(active_id)?.scrollIntoView({ block: 'nearest' })
    }, [active_id, open])

    const menu = open ? createPortal(
        <div id={listbox_id} ref={menuRef} role="listbox" style={menuStyle}>
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
                        onClick={(e) => {
                            e.stopPropagation()
                            select_option(o.value)
                        }}
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
                        {o.label}
                    </div>
                )
            })}
        </div>,
        document.body
    ) : null

    return (
        <div
            ref={ref}
            className="select"
            data-testid={testId}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? listbox_id : undefined}
            aria-activedescendant={open ? active_id : undefined}
            tabIndex={0}
            style={style}
            onClick={() => {
                if (open) setOpen(false)
                else open_menu()
            }}
            onKeyDown={handle_key_down}
        >
            <span>{cur?.label || value}</span>
            <svg
                className="chev"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.85"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M6 9l6 6 6-6" />
            </svg>
            {menu}
        </div>
    )
}

export function ConfigField({ defaultValue, value, onChange, placeholder, mono, style, testId, type }: {
    defaultValue?: string
    value?: string
    onChange?: (v: string) => void
    placeholder?: string
    mono?: boolean
    style?: React.CSSProperties
    testId?: string
    type?: string
}): React.ReactElement {
    return (
        <div className="field" data-testid={testId} style={style}>
            <input
                className={mono ? 'mono' : ''}
                defaultValue={defaultValue}
                value={value}
                onChange={onChange ? (e) => { onChange(e.target.value); } : undefined}
                placeholder={placeholder}
                type={type}
            />
        </div>
    )
}
