import React from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfig } from '../../hooks/use_config'
import { ConfigCard, ConfigRow } from './config_components'

const VERSION = '0.1.0'
const REPO_URL = 'https://github.com/TuTouPower/omni_pot'

export default function AboutPage(): React.ReactElement {
    const { t } = useTranslation()
    const [serverPort] = useConfig('server_port')
    const apiUrl = `http://127.0.0.1:${String(serverPort)}`
    const openExternal = (url: string): void => {
        window.electronAPI.shell.openExternal(url).catch(() => undefined)
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
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>omni_pot</div>
                <div className="hint mono" data-testid="about-version">version {VERSION}</div>
                <div className="hint" style={{ maxWidth: 360 }}>
                    一个面向日常使用的桌面翻译与识别工具，支持多个翻译引擎、OCR 服务和自定义插件。
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button className="btn sm" data-testid="about-home-link" onClick={() => { openExternal(REPO_URL); }}>
                        官网
                    </button>
                    <button className="btn sm" data-testid="about-docs-link" onClick={() => { openExternal(`${REPO_URL}/tree/master/docs`); }}>
                        文档
                    </button>
                    <button className="btn sm" data-testid="about-feedback-link" onClick={() => { openExternal(`${REPO_URL}/issues`); }}>
                        反馈
                    </button>
                    <button className="btn primary sm" data-testid="about-check-update" onClick={() => { openExternal(`${REPO_URL}/releases`); }}>
                        <Icons.Cloud size={12} />
                        {t('about.check_update') || '检查更新'}
                    </button>
                </div>
            </div>

            <ConfigCard title="诊断">
                <ConfigRow label="版本">
                    <div className="mono hint" data-testid="about-diagnostic-version" style={{ marginRight: 8 }}>{VERSION}</div>
                </ConfigRow>
                <ConfigRow label="配置目录">
                    <div className="mono hint" data-testid="about-config-dir" style={{ marginRight: 8 }}>userData/config.json</div>
                </ConfigRow>
                <ConfigRow label="日志目录">
                    <div className="mono hint" data-testid="about-log-dir" style={{ marginRight: 8 }}>userData/logs</div>
                </ConfigRow>
                <ConfigRow label="本机 API">
                    <div className="mono hint" data-testid="about-api-url" style={{ marginRight: 8 }}>{apiUrl}</div>
                    <button className="ic-btn" title="复制" data-testid="about-copy-api" onClick={() => { navigator.clipboard.writeText(apiUrl).catch(() => undefined); }}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
            </ConfigCard>
        </div>
    )
}
