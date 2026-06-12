import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfig } from '../../hooks/use_config'
import { ConfigCard, ConfigRow } from './config_components'

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

export default function AboutPage(): React.ReactElement {
    const { t } = useTranslation()
    const [serverPort] = useConfig('server_port')
    const [apiToken] = useConfig('server_api_token')
    const apiUrl = `http://127.0.0.1:${String(serverPort)}`
    const [configDir, setConfigDir] = useState('...')
    const [logDir, setLogDir] = useState('...')
    const [version, setVersion] = useState('...')
    const [exporting, setExporting] = useState(false)
    const openExternal = (url: string): void => {
        window.electronAPI.shell.openExternal(url).catch(() => undefined)
    }

    useEffect(() => {
        window.electronAPI.log.getDir().then(setLogDir).catch(() => { setLogDir('unknown'); })
        window.electronAPI.config.getUserDir().then(setConfigDir).catch(() => { setConfigDir('unknown'); })
        window.electronAPI.getVersion().then(setVersion).catch(() => { setVersion('unknown'); })
    }, [])

    const handleExportLog = (): void => {
        setExporting(true)
        window.electronAPI.log.export().then((result) => {
            if (result.success && result.path) {
                window.electronAPI.shell.openExternal(`file://${result.path}`).catch(() => undefined)
            }
        }).catch(() => undefined).finally(() => { setExporting(false); })
    }

    return (
        <div className="stack gap-12">
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
                <div
                    className="svc-tile"
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: 16,
                        background: 'var(--brand-primary)',
                        color: '#fff',
                        borderColor: 'transparent',
                        fontSize: 22,
                        fontWeight: 700,
                    }}
                >
                    op
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{t('app_name', { defaultValue: 'Omni Pot' })}</div>
                <div className="hint mono" data-testid="about-version">version {version} · {platform_arch()}</div>
                <div className="hint" style={{ maxWidth: 360 }}>
                    一个面向日常使用的桌面翻译与识别工具，支持多个翻译引擎、OCR 服务和内置服务设置。
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button className="btn sm" data-testid="about-home-link" onClick={() => { openExternal(REPO_URL); }}>
                        官网
                    </button>
                    <button className="btn sm" data-testid="about-docs-link" onClick={() => { openExternal(`${REPO_URL}/tree/master/docs`); }}>
                        文档
                    </button>
                    <button className="btn sm" data-testid="about-survey-link" onClick={() => { openExternal(SURVEY_URL); }}>
                        问卷反馈
                    </button>
                    <button className="btn primary sm" data-testid="about-check-update" onClick={() => { openExternal(`${REPO_URL}/releases`); }}>
                        <Icons.Cloud size={12} />
                        {t('about.check_update')}
                    </button>
                    <button className="btn sm" data-testid="about-support-author" style={{ color: '#9b59b6' }} onClick={() => { openExternal('https://afdian.com/a/tutoupower'); }}>
                        <Icons.Heart size={12} />
                        支持作者
                    </button>
                </div>
            </div>

            <ConfigCard title="诊断">
                <ConfigRow label="日志目录">
                    <div className="mono hint" data-testid="about-log-dir" style={{ marginRight: 8 }}>{logDir}</div>
                    <button className="ic-btn" title="复制路径" data-testid="about-copy-log-dir" onClick={() => { window.electronAPI.text.writeClipboard(logDir).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
                <ConfigRow label="设置目录">
                    <div className="mono hint" data-testid="about-config-dir" style={{ marginRight: 8 }}>{configDir}</div>
                    <button className="ic-btn" title="复制路径" data-testid="about-copy-config-dir" onClick={() => { window.electronAPI.text.writeClipboard(configDir).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
                <ConfigRow label="本机 API">
                    <div className="mono hint" data-testid="about-api-url" style={{ marginRight: 8 }}>{apiUrl}</div>
                    <button className="ic-btn" title={t('about.copy_path', { defaultValue: '复制路径' })} data-testid="about-copy-api" onClick={() => { window.electronAPI.text.writeClipboard(apiUrl).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
                <ConfigRow label="API Token">
                    <div className="mono hint" data-testid="about-api-token" style={{ marginRight: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apiToken || '...'}</div>
                    <button className="ic-btn" title={t('about.copy_token', { defaultValue: '复制 Token' })} data-testid="about-copy-api-token" onClick={() => { if (apiToken) window.electronAPI.text.writeClipboard(apiToken).catch(() => undefined); }}>
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
