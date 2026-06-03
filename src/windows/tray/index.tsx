import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icons } from '../../components/icons'
import { format_hotkey } from '../../utils/format_hotkey'

type TrayAction = 'input_translate' | 'dictionary' | 'ocr_recognize' | 'screenshot_translate' | 'config' | 'auto_start' | 'clipboard_monitor' | 'feedback' | 'support_author' | 'check_update' | 'view_log' | 'restart' | 'quit'

const ACTIONS: Array<{ action: TrayAction; icon: keyof typeof Icons }> = [
    { action: 'input_translate', icon: 'Translate' },
    { action: 'dictionary', icon: 'Type' },
    { action: 'ocr_recognize', icon: 'Camera' },
    { action: 'screenshot_translate', icon: 'Image' },
    { action: 'config', icon: 'Settings' },
    { action: 'auto_start', icon: 'Power' },
    { action: 'clipboard_monitor', icon: 'Copy' },
    { action: 'feedback', icon: 'Info' },
    { action: 'support_author', icon: 'Heart' },
    { action: 'check_update', icon: 'Cloud' },
    { action: 'view_log', icon: 'Info' },
    { action: 'restart', icon: 'Cycle' },
    { action: 'quit', icon: 'Close' },
]

export default function TrayWindow(): React.ReactElement {
    const root_ref = useRef<HTMLDivElement>(null)
    const [labels, setLabels] = useState<string[] | null>(null)
    const [shortcuts, setShortcuts] = useState<Record<string, string>>({})
    const [clipboardMonitoring, setClipboardMonitoring] = useState(false)
    const [autoStart, setAutoStart] = useState(false)

    useEffect(() => {
        Promise.all([
            window.electronAPI.tray.labels(),
            window.electronAPI.tray.clipboardMonitoring(),
            window.electronAPI.tray.autoStart(),
            window.electronAPI.config.getAll(),
        ]).then(([next_labels, monitoring, auto_start, config]) => {
            setLabels(next_labels)
            setClipboardMonitoring(monitoring)
            setAutoStart(auto_start)
            setShortcuts({
                input_translate: config.hotkey_translate,
                dictionary: config.hotkey_selection_dictionary,
                ocr_recognize: config.hotkey_ocr_recognize,
                screenshot_translate: config.hotkey_ocr_translate,
            })
        }).catch(() => undefined)
    }, [])

    useLayoutEffect(() => {
        const root = root_ref.current
        if (!root || labels === null) return
        const width = root.scrollWidth
        const height = root.scrollHeight
        window.electronAPI.tray.popupReady(width, height).then(() => {
            window.electronAPI.ready('tray')
        }).catch(() => undefined)
    }, [labels, shortcuts, clipboardMonitoring, autoStart])

    const run_action = (action: TrayAction): void => {
        window.electronAPI.tray.action(action).then(() => {
            if (action === 'clipboard_monitor') {
                return window.electronAPI.tray.clipboardMonitoring().then(setClipboardMonitoring)
            }
            if (action === 'auto_start') {
                return window.electronAPI.tray.autoStart().then(setAutoStart)
            }
            return undefined
        }).catch(() => undefined)
    }

    if (labels === null) {
        return <div ref={root_ref} data-testid="tray-popover" />
    }

    return (
        <div ref={root_ref} className="op-window" data-testid="tray-popover" style={{ width: 'max-content', height: 'max-content', background: 'var(--bg)', padding: 10, boxSizing: 'border-box' }}>
            <div className="card" style={{ width: 'max-content', padding: 8, borderRadius: 14, boxShadow: '0 10px 34px rgba(17, 24, 39, 0.14)', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-elev)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 10px' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>O</div>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>Omni Pot</div>
                </div>
                {ACTIONS.map(({ action, icon }, index) => {
                    const Icon = Icons[icon]
                    const active = (action === 'clipboard_monitor' && clipboardMonitoring) || (action === 'auto_start' && autoStart)
                    const isSupportAuthor = action === 'support_author'
                    const separator = index === 4 || index === 7 || index === 11
                    return (
                        <React.Fragment key={action}>
                            {separator && <div data-testid="tray-separator" style={{ height: 1, background: 'var(--line)', margin: '4px 6px' }} />}
                            <button
                                data-testid={`tray-action-${action}`}
                                onClick={() => { run_action(action) }}
                                style={{
                                    border: 0,
                                    borderRadius: 6,
                                    background: active ? 'var(--brand-primary-soft)' : 'transparent',
                                    color: active ? 'var(--brand-primary)' : isSupportAuthor ? '#9b59b6' : 'var(--text)',
                                    minHeight: 34,
                                    width: '100%',
                                    minWidth: 0,
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
                                <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{labels[index] ?? action}</span>
                                {shortcuts[action] && <span className="hint mono" style={{ fontSize: 11, whiteSpace: 'nowrap', marginLeft: 14 }}>{format_hotkey(shortcuts[action]).join(' + ')}</span>}
                                {active && <span className="chip" style={{ fontSize: 10, marginLeft: 14 }}>ON</span>}
                            </button>
                        </React.Fragment>
                    )
                })}
            </div>
        </div>
    )
}
