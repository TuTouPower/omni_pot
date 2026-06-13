import React from 'react'
import { useToastStore } from '../stores/toast_store'

export function ToastContainer(): React.ReactElement {
    const toasts = useToastStore((s) => s.toasts)

    if (toasts.length === 0) return <></>

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                position: 'fixed',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                zIndex: 99999,
                pointerEvents: 'none',
            }}
        >
            {toasts.map((t) => (
                <div
                    key={t.id}
                    data-testid="toast"
                    style={{
                        background: 'var(--bg-elev, #fff)',
                        color: 'var(--text, #222)',
                        border: '1px solid var(--line, #ddd)',
                        borderRadius: 8,
                        padding: '6px 14px',
                        fontSize: 12.5,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        animation: 'toast-fade-in 160ms ease-out',
                    }}
                >
                    {t.message}
                </div>
            ))}
        </div>
    )
}
