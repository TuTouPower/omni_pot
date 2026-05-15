import React from 'react'

interface SimpleSelectProps {
    value: string | number
    options: { key: string; label: string }[]
    onChange: (value: string) => void
    label?: string
    className?: string
}

export function SimpleSelect({ value, options, onChange, label, className }: SimpleSelectProps): React.ReactElement {
    return (
        <label className={`flex flex-col gap-1 ${className ?? ''}`}>
            {label && <span className="text-sm text-default-500">{label}</span>}
            <select
                value={String(value)}
                onChange={(e) => { onChange(e.target.value); }}
                className="bg-default-100 border border-default-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
                {options.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
            </select>
        </label>
    )
}
