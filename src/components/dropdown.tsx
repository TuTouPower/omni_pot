import React from 'react'
import { createPortal } from 'react-dom'
import { Icons } from './icons'

interface DropdownOption {
    value: string
    label: string
    mono?: string
}

interface DropdownProps {
    value: string
    options: DropdownOption[]
    onChange: (v: string) => void
    testId: string
    optionTestIdPrefix?: string
    renderTrigger?: (props: { open: boolean; selected: DropdownOption | undefined }) => React.ReactNode
    renderOption?: (props: { option: DropdownOption; selected: boolean; active: boolean }) => React.ReactNode
    popWidth?: number
    triggerStyle?: React.CSSProperties
    chevronSize?: number
    leading?: React.ReactNode
}

export const Dropdown = React.memo(function Dropdown({
    value,
    options,
    onChange,
    testId,
    optionTestIdPrefix,
    renderTrigger,
    renderOption,
    popWidth = 180,
    triggerStyle,
    chevronSize,
    leading,
}: DropdownProps): React.ReactElement {
    const [open, setOpen] = React.useState(false)
    const [active_index, setActiveIndex] = React.useState(0)
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const popRef = React.useRef<HTMLDivElement>(null)
    const [coords, setCoords] = React.useState({ left: 0, top: 0, maxH: 280 })
    const selected_index = Math.max(0, options.findIndex((o) => o.value === value))
    const listbox_id = `${testId}-listbox`
    const active_option = options[active_index] ?? options[0]
    const active_id = active_option ? `${optionTestIdPrefix ?? testId}-${active_option.value}` : undefined

    const measure = React.useCallback(() => {
        const el = triggerRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const popH = Math.min(320, options.length * 30 + 8)
        const spaceBelow = window.innerHeight - r.bottom
        const above = spaceBelow < popH + 12 && r.top > popH + 12
        const wantLeft = r.left + r.width / 2 - popWidth / 2
        const left = Math.min(Math.max(8, wantLeft), window.innerWidth - popWidth - 8)
        setCoords({
            left,
            top: above ? r.top - popH - 6 : r.bottom + 6,
            maxH: popH,
        })
    }, [options.length, popWidth])

    const open_menu = React.useCallback((index = selected_index) => {
        setActiveIndex(index)
        setOpen(true)
    }, [selected_index])

    const select_value = React.useCallback((v: string) => {
        onChange(v)
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
            else if (active_option) select_value(active_option.value)
        } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
        }
    }, [active_option, move_active, open, open_menu, select_value])

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

    const cur = options.find((o) => o.value === value)

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
                style={triggerStyle ?? {
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
                {renderTrigger
                    ? renderTrigger({ open, selected: cur })
                    : (
                        <>
                            {leading}
                            <span>{cur?.label ?? value}</span>
                            <Icons.Chev size={chevronSize ?? 12} style={{ color: 'var(--text-mute)', marginTop: 1, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                        </>
                    )}
            </button>
            {open && createPortal(
                <div
                    id={listbox_id}
                    ref={popRef}
                    role="listbox"
                    onMouseDown={(e) => { e.stopPropagation() }}
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                        width: popWidth,
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--r-md)',
                        boxShadow: '0 10px 28px rgba(0,0,0,0.14)',
                        padding: 4,
                        zIndex: 10000,
                        maxHeight: coords.maxH,
                        overflowY: 'auto',
                    }}
                >
                    {options.map((option, index) => {
                        const selected = option.value === value
                        const active = index === active_index
                        return (
                            <div
                                key={option.value}
                                id={`${optionTestIdPrefix ?? testId}-${option.value}`}
                                role="option"
                                aria-selected={selected}
                                data-testid={`${optionTestIdPrefix ?? testId}-${option.value}`}
                                onClick={() => { select_value(option.value) }}
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
                                {renderOption
                                    ? renderOption({ option, selected, active })
                                    : <span>{option.label}</span>}
                            </div>
                        )
                    })}
                </div>,
                document.body
            )}
        </React.Fragment>
    )
})
