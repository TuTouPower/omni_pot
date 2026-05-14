import React from 'react'
import { useTranslation } from 'react-i18next'
import { useConfig } from '../../hooks/use_config'
import { ConfigCard, ConfigRow, ConfigSwitch, ConfigSelect, ConfigField } from './config_components'

const TRAY_CLICK_OPTIONS = [
    { value: 'show_config', label: 'Show Config' },
    { value: 'show_translate', label: 'Show Translate' },
    { value: 'none', label: 'None' },
]

const THEME_OPTIONS = [
    { value: 'system' as const, label: '跟随系统' },
    { value: 'light' as const, label: '浅色' },
    { value: 'dark' as const, label: '深色' },
]

const FONT_SIZE_OPTIONS = [10, 12, 13, 14, 16, 18, 20, 24].map((s) => ({ value: String(s), label: `${s}px` }))

const IS_MAC = navigator.platform.toLowerCase().includes('mac')

const FONT_OPTIONS = [
    { value: 'default', label: '系统默认' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Consolas', label: 'Consolas' },
    { value: 'Courier New', label: 'Courier New' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Microsoft YaHei', label: 'Microsoft YaHei' },
    { value: 'PingFang SC', label: 'PingFang SC' },
    { value: 'SimHei', label: 'SimHei' },
    { value: 'SimSun', label: 'SimSun' },
    { value: 'Monaco', label: 'Monaco' },
    { value: 'Segoe UI', label: 'Segoe UI' },
    { value: 'Tahoma', label: 'Tahoma' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Trebuchet MS', label: 'Trebuchet MS' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Noto Sans SC', label: 'Noto Sans SC' },
    { value: 'Noto Sans JP', label: 'Noto Sans JP' },
    { value: 'Noto Sans KR', label: 'Noto Sans KR' },
]

export default function GeneralPage(): React.ReactElement {
    const { t } = useTranslation()
    const [appTheme, setAppTheme] = useConfig('app_theme')
    const [appFont, setAppFont] = useConfig('app_font')
    const [fontSize, setFontSize] = useConfig('app_font_size')
    const [transparent, setTransparent] = useConfig('transparent')
    const [devMode, setDevMode] = useConfig('dev_mode')
    const [checkUpdate, setCheckUpdate] = useConfig('check_update')
    const [serverPort, setServerPort] = useConfig('server_port')
    const [proxyEnable, setProxyEnable] = useConfig('proxy_enable')
    const [proxyHost, setProxyHost] = useConfig('proxy_host')
    const [proxyPort, setProxyPort] = useConfig('proxy_port')
    const [autoStart, setAutoStart] = useConfig('auto_start')

    return (
        <div className="stack gap-12">
            <ConfigCard title={t('general.app_settings') || '应用'}>
                <ConfigRow label={t('general.auto_start') || '开机自启'} sub="登录系统后在后台启动 omni_pot">
                    <ConfigSwitch on={autoStart as boolean} onChange={setAutoStart} />
                </ConfigRow>
                <ConfigRow label={t('general.check_update') || '启动时检查更新'}>
                    <ConfigSwitch on={checkUpdate as boolean} onChange={setCheckUpdate} />
                </ConfigRow>
                <ConfigRow label={t('general.server_port') || '本地 API 端口'} sub="供外部脚本调用，修改后需重启">
                    <ConfigField
                        mono
                        defaultValue={String(serverPort)}
                        onChange={(v) => setServerPort(Number(v))}
                        style={{ width: 140 }}
                    />
                </ConfigRow>
            </ConfigCard>

            <ConfigCard title={t('general.appearance') || '外观'}>
                <ConfigRow label={t('general.theme') || '主题'}>
                    <ConfigSelect
                        value={appTheme as 'system' | 'light' | 'dark'}
                        onChange={setAppTheme as (v: 'system' | 'light' | 'dark') => void}
                        options={THEME_OPTIONS}
                        style={{ minWidth: 160 }}
                    />
                </ConfigRow>
                <ConfigRow label={t('general.font_family') || '字体'}>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <ConfigSelect
                            value={appFont as string}
                            onChange={setAppFont}
                            options={FONT_OPTIONS}
                            style={{ minWidth: 140 }}
                        />
                        <ConfigSelect
                            value={String(fontSize)}
                            onChange={(v) => setFontSize(Number(v))}
                            options={FONT_SIZE_OPTIONS}
                            style={{ width: 110 }}
                        />
                    </div>
                </ConfigRow>
                <div
                    className="card"
                    style={{
                        padding: 10,
                        fontFamily: appFont === 'default' ? undefined : (appFont as string),
                        fontSize: Number(fontSize),
                        color: 'var(--text-dim)',
                    }}
                >
                    Preview: Hello World 你好世界 こんにちは 안녕하세요
                </div>
                {IS_MAC && (
                    <ConfigRow label={t('general.transparent') || '透明背景'} sub="毛玻璃效果，部分平台可能影响性能">
                        <ConfigSwitch on={transparent as boolean} onChange={setTransparent} />
                    </ConfigRow>
                )}
                <ConfigRow label={t('general.dev_mode') || '开发者模式'} sub="启用 F12 开发者工具">
                    <ConfigSwitch on={devMode as boolean} onChange={setDevMode} />
                </ConfigRow>
            </ConfigCard>

            <ConfigCard title={t('general.proxy') || '网络代理'}>
                <ConfigRow label={t('general.proxy_enable') || '启用代理'}>
                    <ConfigSwitch on={proxyEnable as boolean} onChange={setProxyEnable} />
                </ConfigRow>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, opacity: proxyEnable ? 1 : 0.5 }}>
                    <ConfigField
                        placeholder="http://127.0.0.1"
                        defaultValue={proxyHost as string}
                        onChange={setProxyHost}
                    />
                    <ConfigField
                        mono
                        placeholder="端口"
                        defaultValue={proxyPort as string}
                        onChange={setProxyPort}
                    />
                </div>
            </ConfigCard>
        </div>
    )
}
