import React from 'react'
import { useTranslation } from 'react-i18next'
import type { AppPrimaryColor } from '@shared/types/config'
import { APP_PRIMARY_COLORS } from '@shared/types/config'
import { useConfig } from '../../hooks/use_config'
import { ConfigCard, ConfigRow, ConfigSwitch, ConfigSelect, ConfigField } from './config_components'


const THEME_VALUES = ['system', 'light', 'dark'] as const

const PRIMARY_COLOR_VALUES: Array<{ key: string; value: AppPrimaryColor; fallback_label: string }> = [
    { key: 'terracotta', value: APP_PRIMARY_COLORS[0], fallback_label: 'Terracotta' },
    { key: 'ultramarine', value: APP_PRIMARY_COLORS[1], fallback_label: 'Ultramarine' },
    { key: 'pine', value: APP_PRIMARY_COLORS[2], fallback_label: 'Pine green' },
    { key: 'mustard', value: APP_PRIMARY_COLORS[3], fallback_label: 'Mustard' },
    { key: 'sky', value: APP_PRIMARY_COLORS[4], fallback_label: 'Sky blue' },
]

const LANGUAGE_VALUES = ['zh_cn', 'en'] as const

const FONT_SIZE_OPTIONS = [10, 12, 13, 14, 16, 18, 20, 24].map((s) => ({ value: String(s), label: `${String(s)}px` }))

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
    const [appLanguage, setAppLanguage] = useConfig('app_language')
    const [appTheme, setAppTheme] = useConfig('app_theme')
    const [appPrimaryColor, setAppPrimaryColor] = useConfig('app_primary_color')
    const [appFont, setAppFont] = useConfig('app_font')
    const [fontSize, setFontSize] = useConfig('app_font_size')
    const [transparent, setTransparent] = useConfig('transparent')
    const [checkUpdate, setCheckUpdate] = useConfig('check_update')
    const [serverPort, setServerPort] = useConfig('server_port')
    const [proxyEnable, setProxyEnable] = useConfig('proxy_enable')
    const [proxyHost, setProxyHost] = useConfig('proxy_host')
    const [proxyPort, setProxyPort] = useConfig('proxy_port')
    const [autoStart, setAutoStart] = useConfig('auto_start')
    const themeOptions = THEME_VALUES.map((value) => ({ value, label: t(`general.theme_${value}`) }))
    const languageOptions = LANGUAGE_VALUES.map((value) => ({ value, label: t(`general.app_language_${value}`) }))
    const fontOptions = FONT_OPTIONS.map((option) => option.value === 'default'
        ? { ...option, label: t('general.font_default') }
        : option)

    return (
        <div className="stack gap-12">
            <ConfigCard title={t('general.app_settings') || '应用'}>
                <ConfigRow label={t('general.auto_start') || '开机自启'} sub={t('general.auto_start_sub')}>
                    <ConfigSwitch on={autoStart} onChange={setAutoStart} testId="cfg-auto_start" />
                </ConfigRow>
                <ConfigRow label={t('general.check_update') || '启动时检查更新'}>
                    <ConfigSwitch on={checkUpdate} onChange={setCheckUpdate} testId="cfg-check_update" />
                </ConfigRow>
                <ConfigRow label={t('general.app_language') || '界面语言'}>
                    <ConfigSelect
                        value={appLanguage as 'zh_cn' | 'en'}
                        onChange={setAppLanguage}
                        options={languageOptions}
                        testId="cfg-app_language"
                        style={{ minWidth: 160 }}
                    />
                </ConfigRow>
                <ConfigRow label={t('general.server_port') || '本地 API 端口'} sub={t('general.server_port_sub')}>
                    <ConfigField
                        mono
                        defaultValue={String(serverPort)}
                        onChange={(v) => { setServerPort(Number(v)); }}
                        testId="cfg-server_port"
                        style={{ width: 140 }}
                    />
                </ConfigRow>
            </ConfigCard>

            <ConfigCard title={t('general.appearance') || '外观'}>
                <ConfigRow label={t('general.theme') || '主题'}>
                    <ConfigSelect
                        value={appTheme}
                        onChange={setAppTheme}
                        options={themeOptions}
                        testId="cfg-app_theme"
                        style={{ minWidth: 160 }}
                    />
                </ConfigRow>
                <ConfigRow label={t('general.primary_color') || '主色'}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {PRIMARY_COLOR_VALUES.map((color) => (
                            <button
                                key={color.key}
                                type="button"
                                data-testid={`cfg-app_primary_color-${color.key}`}
                                aria-label={t(`general.primary_color_${color.key}`, { defaultValue: color.fallback_label })}
                                aria-pressed={appPrimaryColor === color.value}
                                onClick={() => { setAppPrimaryColor(color.value); }}
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 999,
                                    background: color.value,
                                    border: appPrimaryColor === color.value ? '2px solid var(--text)' : '1px solid var(--line-strong)',
                                    boxShadow: appPrimaryColor === color.value ? `0 0 0 3px color-mix(in oklab, ${color.value} 18%, transparent)` : 'none',
                                }}
                            />
                        ))}
                    </div>
                </ConfigRow>
                <ConfigRow label={t('general.font_family') || '字体'}>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <ConfigSelect
                            value={appFont}
                            onChange={setAppFont}
                            options={fontOptions}
                            testId="cfg-app_font"
                            style={{ minWidth: 140 }}
                        />
                        <ConfigSelect
                            value={String(fontSize)}
                            onChange={(v) => { setFontSize(Number(v)); }}
                            options={FONT_SIZE_OPTIONS}
                            testId="cfg-app_font_size"
                            style={{ width: 110 }}
                        />
                    </div>
                </ConfigRow>
                <div
                    className="card"
                    style={{
                        padding: 10,
                        fontFamily: appFont === 'default' ? undefined : (appFont),
                        fontSize,
                        color: 'var(--text-dim)',
                    }}
                >
                    {t('preview')}: Hello World 你好世界 こんにちは 안녕하세요
                </div>
                <ConfigRow label={t('general.transparent') || '透明背景'} sub={t('general.transparent_sub')}>
                    <ConfigSwitch on={transparent} onChange={setTransparent} testId="cfg-transparent" />
                </ConfigRow>
            </ConfigCard>

            <ConfigCard title={t('general.proxy') || '网络代理'}>
                <ConfigRow label={t('general.proxy_enable') || '启用代理'}>
                    <ConfigSwitch on={proxyEnable} onChange={setProxyEnable} testId="cfg-proxy_enable" />
                </ConfigRow>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, opacity: proxyEnable ? 1 : 0.5 }}>
                    <ConfigField
                        placeholder="http://127.0.0.1"
                        defaultValue={proxyHost}
                        onChange={setProxyHost}
                        testId="cfg-proxy_host"
                    />
                    <ConfigField
                        mono
                        placeholder={t('general.proxy_port')}
                        defaultValue={proxyPort}
                        onChange={setProxyPort}
                        testId="cfg-proxy_port"
                    />
                </div>
            </ConfigCard>
        </div>
    )
}
