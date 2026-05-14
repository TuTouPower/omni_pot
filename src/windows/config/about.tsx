import React from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { ConfigCard, ConfigRow } from './config_components'

const VERSION = '0.1.0'

export default function AboutPage(): React.ReactElement {
    const { t } = useTranslation()

    return (
        <div className="stack gap-12">
            {/* Hero section */}
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
                <div className="hint mono">version {VERSION}</div>
                <div className="hint" style={{ maxWidth: 360 }}>
                    一个面向日常使用的桌面翻译与识别工具，支持多个翻译引擎、OCR 服务和自定义插件。
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button className="btn sm" onClick={() => window.open('https://github.com/TuTouPower/omni_pot', '_blank')}>
                        GitHub
                    </button>
                    <button className="btn primary sm" onClick={() => window.open('https://github.com/TuTouPower/omni_pot/releases', '_blank')}>
                        <Icons.Cloud size={12} />
                        {t('about.check_update') || '检查更新'}
                    </button>
                </div>
            </div>

            <ConfigCard title="诊断">
                <ConfigRow label="版本">
                    <div className="mono hint" style={{ marginRight: 8 }}>{VERSION}</div>
                </ConfigRow>
                <ConfigRow label="本机 API">
                    <div className="mono hint" style={{ marginRight: 8 }}>http://127.0.0.1:60828</div>
                    <button className="ic-btn" title="复制" onClick={() => navigator.clipboard.writeText('http://127.0.0.1:60828')}>
                        <Icons.Copy size={12} />
                    </button>
                </ConfigRow>
            </ConfigCard>
        </div>
    )
}
