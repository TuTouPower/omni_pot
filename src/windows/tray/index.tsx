import React, { useEffect, useState } from 'react'
import { Icons } from '../../components/icons'

type TrayAction = 'input_translate' | 'ocr_recognize' | 'screenshot_translate' | 'clipboard_monitor' | 'config' | 'check_update' | 'view_log' | 'restart' | 'quit'

const ACTIONS: Array<{ action: TrayAction; icon: keyof typeof Icons }> = [
    { action: 'input_translate', icon: 'Translate' },
    { action: 'ocr_recognize', icon: 'Camera' },
    { action: 'screenshot_translate', icon: 'Image' },
    { action: 'clipboard_monitor', icon: 'Copy' },
    { action: 'config', icon: 'Settings' },
    { action: 'check_update', icon: 'Cloud' },
    { action: 'view_log', icon: 'Info' },
    { action: 'restart', icon: 'Cycle' },
    { action: 'quit', icon: 'Close' },
]

export default function TrayWindow(): React.ReactElement {
    const [labels, setLabels] = useState<string[]>([])
    const [clipboardMonitoring, setClipboardMonitoring] = useState(false)

    useEffect(() => {
        window.electronAPI.tray.labels().then(setLabels).catch(() => undefined)
        window.electronAPI.tray.clipboardMonitoring().then(setClipboardMonitoring).catch(() => undefined)
        window.electronAPI.ready('tray')
    }, [])

    const run_action = (action: TrayAction): void => {
        window.electronAPI.tray.action(action).then(() => {
            if (action === 'clipboard_monitor') {
                return window.electronAPI.tray.clipboardMonitoring().then(setClipboardMonitoring)
            }
            return undefined
        }).catch(() => undefined)
    }

    return (
        <div className="op-window" data-testid="tray-popover" style={{ width: '100%', height: '100%', background: 'var(--bg)', padding: 10, boxSizing: 'border-box' }}>
            <div className="card" style={{ height: '100%', padding: 8, borderRadius: 14, boxShadow: '0 10px 34px rgba(17, 24, 39, 0.14)', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-elev)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 10px' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>O</div>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>Omni Pot</div>
                </div>
                {ACTIONS.map(({ action, icon }, index) => {
                    const Icon = Icons[icon]
                    const active = action === 'clipboard_monitor' && clipboardMonitoring
                    const separator = index === 4 || index === 5 || index === 7
                    return (
                        <React.Fragment key={action}>
                            {separator && <div data-testid="tray-separator" style={{ height: 1, background: 'var(--line)', margin: '4px 6px' }} />}
                            <button
                                data-testid={`tray-action-${action}`}
                                onClick={() => { run_action(action) }}
                                style={{
                                    border: 0,
                                    borderRadius: 10,
                                    background: active ? 'var(--brand-primary-soft)' : 'transparent',
                                    color: active ? 'var(--brand-primary)' : 'var(--text)',
                                    minHeight: 34,
                                    padding: '0 10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    font: 'inherit',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                }}
                                onMouseEnter={(event) => {
                                    if (!active) event.currentTarget.style.background = 'var(--bg-sunk)'
                                }}
                                onMouseLeave={(event) => {
                                    if (!active) event.currentTarget.style.background = 'transparent'
                                }}
                            >
                                <Icon size={15} />
                                <span style={{ flex: 1 }}>{labels[index] ?? action}</span>
                                {active && <span className="chip" style={{ fontSize: 10 }}>ON</span>}
                            </button>
                        </React.Fragment>
                    )
                })}
            </div>
        </div>
    )
}
