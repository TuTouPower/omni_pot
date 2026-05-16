import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import GeneralPage from './general'
import TranslatePage from './translate_settings'
import RecognizePage from './recognize_settings'
import HotkeyPage from './hotkey_settings'
import ServicePage from './service_settings'
import HistoryPage from './history_settings'
import BackupPage from './backup_settings'
import AboutPage from './about'

type ConfigPage = 'general' | 'translate' | 'recognize' | 'hotkey' | 'service' | 'history' | 'backup' | 'about'

interface NavItem {
    key: ConfigPage
    label: string
    icon: React.ReactNode
}

export default function ConfigWindow(): React.ReactElement {
    const { t } = useTranslation()
    const [activePage, setActivePage] = useState<ConfigPage>('general')
    const [alwaysOnTop, setAlwaysOnTop] = useState(false)
    const handleClose = useCallback(() => window.electronAPI.window.close(), [])
    const handlePin = useCallback(async () => {
        const next = !alwaysOnTop
        await window.electronAPI.window.setAlwaysOnTop(next)
        setAlwaysOnTop(next)
    }, [alwaysOnTop])

    const pages: NavItem[] = [
        { key: 'general', label: t('general.title') || '通用', icon: <Icons.Grid size={15} /> },
        { key: 'translate', label: t('translate_settings.title') || '翻译', icon: <Icons.Translate size={15} /> },
        { key: 'recognize', label: t('recognize.title') || '识别', icon: <Icons.Image size={15} /> },
        { key: 'hotkey', label: t('hotkey.title') || '快捷键', icon: <Icons.Kbd size={15} /> },
        { key: 'service', label: t('service.title') || '服务', icon: <Icons.Layers size={15} /> },
        { key: 'history', label: t('history.title') || '历史', icon: <Icons.Clock size={15} /> },
        { key: 'backup', label: t('backup.title') || '备份', icon: <Icons.Cloud size={15} /> },
        { key: 'about', label: t('about.title') || '关于', icon: <Icons.Info size={15} /> },
    ]

    const renderPage = (): React.ReactElement => {
        switch (activePage) {
            case 'general': return <GeneralPage />
            case 'translate': return <TranslatePage />
            case 'recognize': return <RecognizePage />
            case 'hotkey': return <HotkeyPage />
            case 'service': return <ServicePage />
            case 'history': return <HistoryPage />
            case 'backup': return <BackupPage />
            case 'about': return <AboutPage />
        }
    }

    const cur = pages.find((n) => n.key === activePage)

    return (
        <div className="op-window" style={{ width: 880, height: 600 }}>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* Sidebar */}
                <div style={{
                    width: 184,
                    background: 'var(--bg-card)',
                    borderRight: '1px solid var(--line-soft)',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <div style={{ height: 38, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                            className="ic-btn"
                            title="置顶"
                            data-testid="config-pin"
                            aria-pressed={alwaysOnTop}
                            onClick={() => { handlePin().catch(console.error); }}
                            style={{ color: alwaysOnTop ? 'var(--brand-primary)' : 'var(--text-mute)' }}
                        >
                            <Icons.Pin size={13} />
                        </button>
                        <div className="op-wordmark" data-testid="config-wordmark">
                            Omni Pot
                        </div>
                    </div>
                    <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        {pages.map((n) => (
                            <button
                                key={n.key}
                                data-testid={`config-nav-${n.key}`}
                                aria-current={activePage === n.key ? 'page' : undefined}
                                onClick={() => { setActivePage(n.key); }}
                                style={{
                                    height: 30,
                                    padding: '0 10px',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    background: activePage === n.key ? 'var(--bg-elev)' : 'transparent',
                                    border: '1px solid ' + (activePage === n.key ? 'var(--line)' : 'transparent'),
                                    color: activePage === n.key ? 'var(--text)' : 'var(--text-dim)',
                                    fontSize: 13,
                                    fontWeight: activePage === n.key ? 500 : 400,
                                    cursor: 'pointer',
                                    transition: 'background .12s, color .12s',
                                    fontFamily: 'inherit',
                                }}
                            >
                                <span style={{ color: activePage === n.key ? 'var(--brand-primary)' : 'var(--text-mute)' }}>
                                    {n.icon}
                                </span>
                                {n.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--line-soft)' }}>
                        <div className="hint mono" data-testid="config-version" style={{ fontSize: 10.5 }}>v0.1.0</div>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ height: 38, display: 'flex', alignItems: 'center', padding: '0 10px 0 14px', gap: 8 }}>
                        <div data-testid="config-title" style={{ fontSize: 14, fontWeight: 600 }}>{cur?.label}</div>
                        <div style={{ flex: 1 }} />
                        <button className="ic-btn" title="关闭" data-testid="config-close" onClick={() => { handleClose().catch(console.error); }}>
                            <Icons.Close size={14} />
                        </button>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 16px' }}>
                        {renderPage()}
                    </div>
                </div>
            </div>
        </div>
    )
}
