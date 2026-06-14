import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfig } from '../../hooks/use_config'
import { ConfigCard, ConfigRow } from './config_components'
import { show_toast } from '../../stores/toast_store'

function platform_arch(): string {
    try {
        return `${process.platform}-${process.arch}`
    } catch { /* not in Node context */ }
    const ua = navigator.userAgent
    if (/Win/.test(ua)) return 'win32-x64'
    if (/Mac/.test(ua)) return 'darwin-arm64'
    if (/Linux/.test(ua)) return 'linux-x64'
    return 'unknown'
}
const REPO_URL = 'https://github.com/TuTouPower/omni_pot'
const SURVEY_URL = 'https://wj.qq.com/edit?sid=27007386'
const PRIVACY_URL = `${REPO_URL}/blob/main/docs/Omni%20Pot%20Privacy.html`
const TERMS_URL = `${REPO_URL}/blob/main/docs/Omni%20Pot%20Terms.html`

const open_external = (url: string): void => {
    window.electronAPI.shell.openExternal(url).catch(() => undefined)
}

interface TileDef {
    key: string
    label: string
    sub: string
    icon: React.ReactNode
    icon_bg: string
    external?: boolean
    action: () => void
}

export default function AboutPage(): React.ReactElement {
    const { t } = useTranslation()
    const [serverPort] = useConfig('server_port')
    const [apiToken] = useConfig('server_api_token')
    const apiUrl = `http://127.0.0.1:${String(serverPort)}`
    const [configDir, setConfigDir] = useState('...')
    const [logDir, setLogDir] = useState('...')
    const [version, setVersion] = useState('...')
    const [exporting, setExporting] = useState(false)
    const handleExportLog = (): void => {
        setExporting(true)
        window.electronAPI.log.export().then((result) => {
            if (result.success && result.path) {
                window.electronAPI.shell.openExternal(`file://${result.path}`).catch(() => undefined)
            }
        }).catch(() => undefined).finally(() => { setExporting(false); })
    }

    useEffect(() => {
        window.electronAPI.log.getDir().then(setLogDir).catch(() => { setLogDir('unknown'); })
        window.electronAPI.config.getUserDir().then(setConfigDir).catch(() => { setConfigDir('unknown'); })
        window.electronAPI.getVersion().then(setVersion).catch(() => { setVersion('unknown'); })
    }, [])

    const tiles: TileDef[] = [
        {
            key: 'update',
            label: t('about.check_update'),
            sub: t('about.check_update_sub'),
            icon: <Icons.Cloud size={19} />,
            icon_bg: 'var(--brand-primary)',
            action: () => { open_external(`${REPO_URL}/releases`); },
        },
        {
            key: 'home',
            label: t('about.home'),
            sub: t('about.home_sub'),
            icon: <Icons.Globe size={19} />,
            icon_bg: 'var(--brand-primary)',
            external: true,
            action: () => { open_external(REPO_URL); },
        },
        {
            key: 'docs',
            label: t('about.docs'),
            sub: t('about.docs_sub'),
            icon: <Icons.Grid size={19} />,
            icon_bg: 'var(--brand-primary)',
            external: true,
            action: () => { open_external(`${REPO_URL}/tree/master/docs`); },
        },
        {
            key: 'feedback',
            label: t('about.feedback'),
            sub: t('about.feedback_sub'),
            icon: <Icons.Edit size={19} />,
            icon_bg: 'var(--brand-primary)',
            external: true,
            action: () => { open_external(SURVEY_URL); },
        },
        {
            key: 'support',
            label: t('about.support'),
            sub: t('about.support_sub'),
            icon: <Icons.Heart size={19} />,
            icon_bg: 'oklch(62% 0.15 12)',
            action: () => { open_external('https://afdian.com/a/tutoupower'); },
        },
        {
            key: 'license',
            label: t('about.license'),
            sub: t('about.license_sub'),
            icon: <Icons.Layers size={19} />,
            icon_bg: 'var(--brand-primary)',
            action: () => { open_external(`${REPO_URL}/blob/master/LICENSE`); },
        },
    ]

    return (
        <div className="about-page">
            <div className="about-top-grid">
                <div className="about-hero" data-testid="about-hero">
                    <div className="about-logo" data-testid="about-hero-logo">op</div>
                    <div className="about-hero-name" data-testid="about-hero-name">
                        {t('app_name', { defaultValue: 'Omni Pot' })}
                    </div>
                    <div className="about-ver" data-testid="about-hero-version">
                        {t('about.version')} {version}
                    </div>
                    <div className="hint mono about-platform">
                        {platform_arch()}
                    </div>
                    <div className="about-divider" />
                    <div className="hint about-description" data-testid="about-hero-description">
                        {t('about.description')}
                    </div>
                    <div style={{ flex: 1 }} />
                    <div className="about-links">
                        <a data-testid="about-link-privacy" onClick={() => { open_external(PRIVACY_URL); }}>
                            {t('about.privacy')}
                        </a>
                        <span className="sep">·</span>
                        <a data-testid="about-link-terms" onClick={() => { open_external(TERMS_URL); }}>
                            {t('about.terms')}
                        </a>
                    </div>
                    <div className="hint about-copyright" data-testid="about-copyright">
                        {t('about.copyright')}
                    </div>
                </div>

                <div className="about-grid" data-testid="about-grid">
                    {tiles.map((tile) => (
                        <div
                            key={tile.key}
                            className="about-tile"
                            data-testid={`about-tile-${tile.key}`}
                            onClick={tile.action}
                        >
                            {tile.external && (
                                <div className="tile-arrow" data-testid="tile-arrow">
                                    <Icons.ChevR size={15} />
                                </div>
                            )}
                            <div className="tile-ic" style={{ background: tile.icon_bg, color: '#fff' }}>
                                {tile.icon}
                            </div>
                            <div>
                                <div className="tile-label">{tile.label}</div>
                                <div className="tile-sub">{tile.sub}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <ConfigCard title={t('about.diagnostics')}>
                <ConfigRow label={t('about.log_dir')}>
                    <div className="mono hint" data-testid="about-log-dir" style={{ marginRight: 8 }}>{logDir}</div>
                    <button className="ic-btn" title={t('about.copy_path')} data-testid="about-copy-log-dir" onClick={() => { window.electronAPI.text.writeClipboard(logDir).then(() => { show_toast(t('toast.copied')) }).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
                <ConfigRow label={t('about.config_dir')}>
                    <div className="mono hint" data-testid="about-config-dir" style={{ marginRight: 8 }}>{configDir}</div>
                    <button className="ic-btn" title={t('about.copy_path')} data-testid="about-copy-config-dir" onClick={() => { window.electronAPI.text.writeClipboard(configDir).then(() => { show_toast(t('toast.copied')) }).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
                <ConfigRow label={t('about.local_api')}>
                    <div className="mono hint" data-testid="about-api-url" style={{ marginRight: 8 }}>{apiUrl}</div>
                    <button className="ic-btn" title={t('about.copy_path')} data-testid="about-copy-api" onClick={() => { window.electronAPI.text.writeClipboard(apiUrl).then(() => { show_toast(t('toast.copied')) }).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
                <ConfigRow label="API Token">
                    <div className="mono hint" data-testid="about-api-token" style={{ marginRight: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apiToken || '...'}</div>
                    <button className="ic-btn" title={t('about.copy_token')} data-testid="about-copy-api-token" onClick={() => { if (apiToken) window.electronAPI.text.writeClipboard(apiToken).then(() => { show_toast(t('toast.copied')) }).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
                <ConfigRow label={t('about.log')} sub={t('about.log_sub')}>
                    <button className="btn sm" data-testid="about-export-log" disabled={exporting} onClick={handleExportLog}>
                        <Icons.Export size={12} />
                        {exporting ? t('about.exporting') : t('about.export_log')}
                    </button>
                </ConfigRow>
            </ConfigCard>
        </div>
    )
}
