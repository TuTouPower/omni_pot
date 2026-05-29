import React, { useCallback, useEffect, useState } from 'react'
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
import { create_logger } from '../../utils/logger'

const log = create_logger('config')

function log_error(action: string, err: unknown): void {
    log.error('%s failed: %s', action, err instanceof Error ? err.message : String(err))
}

type ConfigPage = 'general' | 'translate' | 'recognize' | 'hotkey' | 'service' | 'history' | 'backup' | 'about'

interface NavItem {
    key: ConfigPage
    label: string
    icon: React.ReactNode
}

export default function ConfigWindow(): React.ReactElement {
    const { t } = useTranslation()
    const [activePage, setActivePage] = useState<ConfigPage>('general')
    const [version, setVersion] = useState('')
    const handleClose = useCallback(() => window.electronAPI.window.close(), [])

    useEffect(() => {
        window.electronAPI.getVersion().then(setVersion).catch(() => {})
    }, [])

    useEffect(() => {
        window.electronAPI.ready('config')
        const valid_sections: ConfigPage[] = ['general', 'translate', 'recognize', 'hotkey', 'service', 'history', 'backup', 'about']
        const unsub = window.electronAPI.window.onConfigNavigate((section) => {
            if ((valid_sections as string[]).includes(section)) {
                setActivePage(section as ConfigPage)
            }
        })
        return unsub
    }, [])

    const pages: NavItem[] = [
        { key: 'general', label: t('general.title', { defaultValue: '通用' }), icon: <Icons.Grid size={15} /> },
        { key: 'translate', label: t('translate_settings.title', { defaultValue: '翻译' }), icon: <Icons.Translate size={15} /> },
        { key: 'recognize', label: t('recognize.title', { defaultValue: '识别' }), icon: <Icons.Image size={15} /> },
        { key: 'hotkey', label: t('hotkey.title', { defaultValue: '快捷键' }), icon: <Icons.Kbd size={15} /> },
        { key: 'service', label: t('service.title', { defaultValue: '服务' }), icon: <Icons.Layers size={15} /> },
        { key: 'history', label: t('history.title', { defaultValue: '历史' }), icon: <Icons.Clock size={15} /> },
        { key: 'backup', label: t('backup.title', { defaultValue: '备份' }), icon: <Icons.Cloud size={15} /> },
        { key: 'about', label: t('about.title', { defaultValue: '关于' }), icon: <Icons.Info size={15} /> },
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
        <div className="op-window" data-testid="config-window" style={{ width: '100vw', height: '100vh' }}>
            {/* Single titlebar spanning full width */}
            <div className="op-titlebar" data-testid="config-titlebar">
                <div className="op-wordmark" style={{ marginLeft: 4 }} data-testid="config-wordmark">
                    Omni Pot
                </div>
                <span className="op-mode" data-testid="config-title">{t('config.title', { defaultValue: '设置' })} · {cur?.label}</span>
                <div style={{ flex: 1 }} />
                <div className="op-wmctl" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                    <button title={t('minimize')} data-testid="config-minimize" onClick={() => { window.electronAPI.window.minimize().catch((err: unknown) => { log_error('minimize window', err) }); }} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                        <Icons.Min size={15} />
                    </button>
                    <button title={t('maximize')} data-testid="config-maximize" onClick={() => { window.electronAPI.window.maximize().catch((err: unknown) => { log_error('maximize window', err) }); }} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                        <Icons.Max size={13} />
                    </button>
                    <button className="close" title={t('close')} data-testid="config-close" onClick={() => { handleClose().catch((err: unknown) => { log_error('close window', err) }); }} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                        <Icons.Close size={15} />
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                <div style={{
                    width: 184,
                    background: 'var(--bg-card)',
                    borderRight: '1px solid var(--line-soft)',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
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
                                    border: '1px solid ' + (activePage === n.key ? 'var(--line-soft)' : 'transparent'),
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
                        <div className="hint mono" data-testid="config-version" style={{ fontSize: 10.5 }}>v{version}</div>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 16px' }}>
                        {renderPage()}
                    </div>
                </div>
            </div>
        </div>
    )
}
