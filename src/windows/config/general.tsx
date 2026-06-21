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

const LANGUAGE_VALUES = ['zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'de'] as const

export default function GeneralPage(): React.ReactElement {
    const { t } = useTranslation()
    const [appLanguage, setAppLanguage] = useConfig('app_language')
    const [appTheme, setAppTheme] = useConfig('app_theme')
    const [appPrimaryColor, setAppPrimaryColor] = useConfig('app_primary_color')
    const [transparent, setTransparent] = useConfig('transparent')
    const [checkUpdate, setCheckUpdate] = useConfig('check_update')
    const [serverPort, setServerPort] = useConfig('server_port')
    const [autoStart, setAutoStart] = useConfig('auto_start')
    const [trayClickEvent, setTrayClickEvent] = useConfig('tray_click_event')
    const languageOptions = LANGUAGE_VALUES.map((value) => ({ value, label: t(`general.app_language_${value}`) }))

    return (
        <div className="stack gap-12">
            <ConfigCard title={t('general.app_settings', { defaultValue: '应用' })}>
                <ConfigRow label={t('general.auto_start', { defaultValue: '开机自启' })} sub={t('general.auto_start_sub')}>
                    <ConfigSwitch on={autoStart} onChange={setAutoStart} testId="cfg-auto_start" />
                </ConfigRow>
                <ConfigRow label={t('general.check_update', { defaultValue: '启动时检查更新' })}>
                    <ConfigSwitch on={checkUpdate} onChange={setCheckUpdate} testId="cfg-check_update" />
                </ConfigRow>
                <ConfigRow label={t('general.tray_click', { defaultValue: '托盘点击事件' })}>
                    <ConfigSelect
                        value={trayClickEvent}
                        onChange={setTrayClickEvent}
                        options={[
                            { value: 'show_config' as const, label: t('general.tray_show_config', { defaultValue: '显示设置' }) },
                            { value: 'show_translate' as const, label: t('general.tray_show_translate', { defaultValue: '显示翻译' }) },
                            { value: 'none' as const, label: t('general.tray_none', { defaultValue: '无' }) },
                        ]}
                        testId="cfg-tray_click_event"
                        style={{ minWidth: 140 }}
                    />
                </ConfigRow>
                <ConfigRow label={t('general.app_language', { defaultValue: '界面语言' })}>
                    <ConfigSelect
                        value={appLanguage as typeof LANGUAGE_VALUES[number]}
                        onChange={setAppLanguage}
                        options={languageOptions}
                        testId="cfg-app_language"
                        style={{ minWidth: 160 }}
                    />
                </ConfigRow>
                <ConfigRow label={t('general.server_port', { defaultValue: '本地 API 端口' })} sub={t('general.server_port_sub')} help={{ href: 'https://github.com/TuTouPower/omni_pot/blob/main/docs/user_docs/cn/api.md', title: 'API 文档' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <ConfigField
                            mono
                            value={String(serverPort)}
                            onChange={(v) => {
                                const n = Number(v)
                                const clamped = Number.isFinite(n) && n >= 1 && n <= 65535 ? n : 20202
                                setServerPort(clamped)
                            }}
                            testId="cfg-server_port"
                            style={{ width: 140 }}
                        />
                    </div>
                </ConfigRow>
            </ConfigCard>

            <ConfigCard title={t('general.appearance', { defaultValue: '外观' })}>
                <ConfigRow label={t('general.theme', { defaultValue: '主题' })}>
                    <div style={{ display: 'flex', gap: 0, background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                        {THEME_VALUES.map((value) => (
                            <button
                                key={value}
                                type="button"
                                data-testid={`cfg-app_theme-${value}`}
                                onClick={() => { setAppTheme(value); }}
                                style={{
                                    padding: '5px 14px',
                                    fontSize: 12,
                                    fontWeight: appTheme === value ? 600 : 400,
                                    background: appTheme === value ? 'var(--bg-elev)' : 'transparent',
                                    color: appTheme === value ? 'var(--text)' : 'var(--text-dim)',
                                    border: 'none',
                                    borderRight: value !== 'dark' ? '1px solid var(--line)' : 'none',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    transition: 'background .12s, color .12s',
                                }}
                            >
                                {t(`general.theme_${value}`)}
                            </button>
                        ))}
                    </div>
                </ConfigRow>
                <ConfigRow label={t('general.primary_color', { defaultValue: '主色' })}>
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
                <ConfigRow label={t('general.transparent', { defaultValue: '透明背景' })} sub={t('general.transparent_sub')}>
                    <ConfigSwitch on={transparent} onChange={setTransparent} testId="cfg-transparent" />
                </ConfigRow>
            </ConfigCard>
        </div>
    )
}
