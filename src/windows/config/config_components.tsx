import React from 'react'

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

export function ConfigRow({ label, sub, children, testId }: {
    label: string
    sub?: string
    children?: React.ReactNode
    testId?: string
}): React.ReactElement {
    return (
        <div className="row" data-testid={testId} style={{ minHeight: 36 }}>
            <div className="label">
                {label}
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
            className={'switch' + (on ? ' on' : '')}
            onClick={() => onChange && onChange(!on)}
        />
    )
}

export function ConfigSelect<T extends string>({ value, onChange, options, style, testId }: {
    value: T
    onChange?: (v: T) => void
    options: { value: T; label: string }[]
    style?: React.CSSProperties
    testId?: string
}): React.ReactElement {
    const [open, setOpen] = React.useState(false)
    const ref = React.useRef<HTMLDivElement>(null)
    const cur = options.find((o) => o.value === value)

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
        <div ref={ref} className="select" data-testid={testId} style={style} onClick={() => setOpen((o) => !o)}>
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
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    minWidth: '100%',
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                    padding: 4,
                    zIndex: 50,
                    maxHeight: 280,
                    overflowY: 'auto',
                }}>
                    {options.map((o) => (
                        <div
                            key={o.value}
                            onClick={(e) => {
                                e.stopPropagation()
                                onChange && onChange(o.value)
                                setOpen(false)
                            }}
                            style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: o.value === value ? 'var(--brand-primary-soft)' : 'transparent',
                                color: o.value === value ? 'var(--brand-primary)' : 'var(--text)',
                                fontSize: 13,
                            }}
                            onMouseEnter={(e) => {
                                if (o.value !== value) e.currentTarget.style.background = 'var(--bg-sunk)'
                            }}
                            onMouseLeave={(e) => {
                                if (o.value !== value) e.currentTarget.style.background = 'transparent'
                            }}
                        >
                            {o.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export function ConfigField({ defaultValue, value, onChange, placeholder, mono, style, testId }: {
    defaultValue?: string
    value?: string
    onChange?: (v: string) => void
    placeholder?: string
    mono?: boolean
    style?: React.CSSProperties
    testId?: string
}): React.ReactElement {
    return (
        <div className="field" data-testid={testId} style={style}>
            <input
                className={mono ? 'mono' : ''}
                defaultValue={defaultValue}
                value={value}
                onChange={onChange ? (e) => onChange(e.target.value) : undefined}
                placeholder={placeholder}
            />
        </div>
    )
}
