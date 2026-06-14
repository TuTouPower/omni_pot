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
            label: '检查更新',
            sub: t('about.check_update', { defaultValue: '检查更新' }),
            icon: <Icons.Cloud size={19} />,
            icon_bg: 'var(--brand-primary)',
            action: () => { open_external(`${REPO_URL}/releases`); },
        },
        {
            key: 'home',
            label: '官网',
            sub: 'github.com/TuTouPower',
            icon: <Icons.Globe size={19} />,
            icon_bg: 'var(--brand-primary)',
            external: true,
            action: () => { open_external(REPO_URL); },
        },
        {
            key: 'docs',
            label: '文档与帮助',
            sub: '使用指南与 API',
            icon: <Icons.Grid size={19} />,
            icon_bg: 'var(--brand-primary)',
            external: true,
            action: () => { open_external(`${REPO_URL}/tree/master/docs`); },
        },
        {
            key: 'feedback',
            label: '反馈与联系',
            sub: '问卷与建议',
            icon: <Icons.Edit size={19} />,
            icon_bg: 'var(--brand-primary)',
            external: true,
            action: () => { open_external(SURVEY_URL); },
        },
        {
            key: 'support',
            label: '支持作者',
            sub: '爱发电赞助',
            icon: <Icons.Heart size={19} />,
            icon_bg: 'oklch(62% 0.15 12)',
            action: () => { open_external('https://afdian.com/a/tutoupower'); },
        },
        {
            key: 'license',
            label: '开源许可',
            sub: 'MIT License',
            icon: <Icons.Layers size={19} />,
            icon_bg: 'var(--brand-primary)',
            action: () => { open_external(`${REPO_URL}/blob/master/LICENSE`); },
        },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Top: hero + action tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '214px 1fr', gap: 12 }}>
                {/* Hero card */}
                <div className="about-hero" data-testid="about-hero">
                    <div className="about-logo" data-testid="about-hero-logo">op</div>
                    <div data-testid="about-hero-name" style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 16, whiteSpace: 'nowrap' }}>
                        {t('app_name', { defaultValue: 'Omni Pot' })}
                    </div>
                    <div className="about-ver" data-testid="about-hero-version" style={{ marginTop: 10 }}>
                        版本 {version}
                    </div>
                    <div className="hint mono" style={{ marginTop: 9 }}>
                        {platform_arch()}
                    </div>
                    <div style={{ width: '72%', height: 1, background: 'var(--line-soft)', margin: '18px 0' }} />
                    <div className="hint" data-testid="about-hero-description" style={{ lineHeight: 1.65, maxWidth: 180 }}>
                        桌面翻译与文字识别工具，覆盖主流在线翻译、离线词典与 OCR 服务，开箱即用。
                    </div>
                    <div style={{ flex: 1 }} />
                    <div className="about-links" style={{ marginTop: 18 }}>
                        <a data-testid="about-link-privacy" style={{ fontSize: 11.5 }}>隐私政策</a>
                        <span className="sep" style={{ fontSize: 10 }}>·</span>
                        <a data-testid="about-link-terms" style={{ fontSize: 11.5 }}>服务条款</a>
                    </div>
                    <div className="hint" data-testid="about-copyright" style={{ marginTop: 8, fontSize: 10.5 }}>
                        © 2026 Omni Pot · 保留所有权利
                    </div>
                </div>

                {/* Action tiles grid */}
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

            {/* Diagnostics card */}
            <ConfigCard title="诊断">
                <ConfigRow label="日志目录">
                    <div className="mono hint" data-testid="about-log-dir" style={{ marginRight: 8 }}>{logDir}</div>
                    <button className="ic-btn" title={t('about.copy_path', { defaultValue: '复制路径' })} data-testid="about-copy-log-dir" onClick={() => { window.electronAPI.text.writeClipboard(logDir).then(() => { show_toast(t('toast.copied', { defaultValue: '已复制' })) }).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
                <ConfigRow label="设置目录">
                    <div className="mono hint" data-testid="about-config-dir" style={{ marginRight: 8 }}>{configDir}</div>
                    <button className="ic-btn" title={t('about.copy_path', { defaultValue: '复制路径' })} data-testid="about-copy-config-dir" onClick={() => { window.electronAPI.text.writeClipboard(configDir).then(() => { show_toast(t('toast.copied', { defaultValue: '已复制' })) }).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
                <ConfigRow label="本机 API">
                    <div className="mono hint" data-testid="about-api-url" style={{ marginRight: 8 }}>{apiUrl}</div>
                    <button className="ic-btn" title={t('about.copy_path', { defaultValue: '复制路径' })} data-testid="about-copy-api" onClick={() => { window.electronAPI.text.writeClipboard(apiUrl).then(() => { show_toast(t('toast.copied', { defaultValue: '已复制' })) }).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
                <ConfigRow label="API Token">
                    <div className="mono hint" data-testid="about-api-token" style={{ marginRight: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apiToken || '...'}</div>
                    <button className="ic-btn" title={t('about.copy_token', { defaultValue: '复制 Token' })} data-testid="about-copy-api-token" onClick={() => { if (apiToken) window.electronAPI.text.writeClipboard(apiToken).then(() => { show_toast(t('toast.copied', { defaultValue: '已复制' })) }).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
                <ConfigRow label={t('about.log', { defaultValue: '日志' })} sub={t('about.log_sub', { defaultValue: '最近 7 天的日志打包为 zip，可附在反馈中' })}>
                    <button className="btn sm" data-testid="about-export-log" disabled={exporting} onClick={handleExportLog}>
                        <Icons.Export size={12} />
                        {exporting ? t('about.exporting', { defaultValue: '导出中...' }) : t('about.export_log', { defaultValue: '导出日志' })}
                    </button>
                </ConfigRow>
            </ConfigCard>
        </div>
    )
}
