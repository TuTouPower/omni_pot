import React from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from './icons'

interface TitlebarProps {
    alwaysOnTop: boolean
    pinned: boolean
    onToggleTopmost: () => void
    onTogglePin: () => void
    modeLabel: string
    onClose: () => void
    containerRef?: React.Ref<HTMLDivElement>
}

const btn_style = {
    width: 30,
    height: 30,
    borderRadius: 6,
    display: 'grid',
    placeItems: 'center',
    color: 'var(--brand-primary)',
    background: 'transparent',
    border: 0,
    padding: 0,
    WebkitAppRegion: 'no-drag',
    cursor: 'pointer',
} as React.CSSProperties

export function Titlebar({ alwaysOnTop, pinned, onToggleTopmost, onTogglePin, modeLabel, onClose, containerRef }: TitlebarProps): React.ReactElement {
    const { t } = useTranslation()
    return (
        <div ref={containerRef} className="op-titlebar" data-testid="titlebar">
            <div style={{ display: 'flex', gap: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <button
                    title={t('translate_settings.always_on_top')}
                    data-testid="titlebar-topmost"
                    aria-pressed={alwaysOnTop}
                    onClick={onToggleTopmost}
                    style={btn_style}
                >
                    <Icons.Pin size={25} fill={alwaysOnTop} />
                </button>
                <button
                    title={t('pin')}
                    data-testid="titlebar-pin"
                    aria-pressed={pinned}
                    onClick={onTogglePin}
                    style={btn_style}
                >
                    <Icons.Lock size={24} fill={pinned} />
                </button>
            </div>
            <div className="op-wordmark" style={{ marginLeft: 2 }} data-testid="titlebar-wordmark">
                {t('app_name', { defaultValue: 'Omni Pot' })}
            </div>
            <span className="op-mode" data-testid="titlebar-mode">{modeLabel}</span>
            <div style={{ flex: 1 }} />
            <button className="op-close" title={t('close')} data-testid="titlebar-close" onClick={onClose}>
                <Icons.Close size={20} />
            </button>
        </div>
    )
}
