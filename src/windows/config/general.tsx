import React from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Label, NumberField, Switch, TextField } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'
import { SimpleSelect } from '../../components/simple_select'

const TRAY_CLICK_OPTIONS = [
    { key: 'show_config', label: 'Show Config' },
    { key: 'show_translate', label: 'Show Translate' },
    { key: 'none', label: 'None' }
]

const THEME_OPTIONS = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' }
]

const FONT_SIZE_OPTIONS = [10, 12, 14, 16, 18, 20, 24].map((s) => ({ key: String(s), label: `${s}px` }))

const IS_MAC = navigator.platform.toLowerCase().includes('mac')

const FONT_OPTIONS = [
    { key: 'default', label: 'System Default' },
    { key: 'Arial', label: 'Arial' },
    { key: 'Consolas', label: 'Consolas' },
    { key: 'Courier New', label: 'Courier New' },
    { key: 'Georgia', label: 'Georgia' },
    { key: 'Microsoft YaHei', label: 'Microsoft YaHei' },
    { key: 'PingFang SC', label: 'PingFang SC' },
    { key: 'SimHei', label: 'SimHei' },
    { key: 'SimSun', label: 'SimSun' },
    { key: 'Monaco', label: 'Monaco' },
    { key: 'Segoe UI', label: 'Segoe UI' },
    { key: 'Tahoma', label: 'Tahoma' },
    { key: 'Times New Roman', label: 'Times New Roman' },
    { key: 'Trebuchet MS', label: 'Trebuchet MS' },
    { key: 'Verdana', label: 'Verdana' },
    { key: 'Noto Sans SC', label: 'Noto Sans SC' },
    { key: 'Noto Sans JP', label: 'Noto Sans JP' },
    { key: 'Noto Sans KR', label: 'Noto Sans KR' },
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
    const [trayClickEvent, setTrayClickEvent] = useConfig('tray_click_event')

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">{t('general.title')}</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">{t('general.app_settings')}</h4>
                    <Switch isSelected={checkUpdate} onChange={setCheckUpdate}>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label className="text-sm">{t('general.check_update')}</Label>
                        </Switch.Content>
                    </Switch>
                    <Switch isSelected={autoStart} onChange={setAutoStart}>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label className="text-sm">{t('general.auto_start')}</Label>
                        </Switch.Content>
                    </Switch>
                    <SimpleSelect label={t('general.tray_click')} value={trayClickEvent as string} onChange={(v) => setTrayClickEvent(v)} options={TRAY_CLICK_OPTIONS} />
                    <NumberField
                        value={serverPort}
                        onChange={(v) => { if (typeof v === 'number') setServerPort(v) }}
                        minValue={0}
                        maxValue={65535}
                    >
                        <Label>{t('general.server_port')}</Label>
                        <NumberField.Group>
                            <NumberField.DecrementButton />
                            <NumberField.Input />
                            <NumberField.IncrementButton />
                        </NumberField.Group>
                    </NumberField>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">{t('general.appearance')}</h4>
                    <SimpleSelect label={t('general.theme')} value={appTheme as string} onChange={(v) => setAppTheme(v)} options={THEME_OPTIONS} />
                    <SimpleSelect label={t('general.font_size')} value={String(fontSize)} onChange={(v) => setFontSize(Number(v))} options={FONT_SIZE_OPTIONS} />
                    <SimpleSelect label={t('general.font_family')} value={appFont as string} onChange={(v) => setAppFont(v)} options={FONT_OPTIONS} />
                    <div
                        className="p-2 rounded-md bg-default-50 text-sm border border-default-200"
                        style={{ fontFamily: appFont === 'default' ? undefined : (appFont as string), fontSize: Number(fontSize) }}
                    >
                        Preview: Hello World 你好世界 こんにちは 안녕하세요
                    </div>
                    {IS_MAC && (
                        <Switch isSelected={transparent} onChange={setTransparent}>
                            <Switch.Control>
                                <Switch.Thumb />
                            </Switch.Control>
                            <Switch.Content>
                                <Label className="text-sm">{t('general.transparent')}</Label>
                            </Switch.Content>
                        </Switch>
                    )}
                    <Switch isSelected={devMode} onChange={setDevMode}>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label className="text-sm">{t('general.dev_mode')}</Label>
                        </Switch.Content>
                    </Switch>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">{t('general.proxy')}</h4>
                    <Switch isSelected={proxyEnable} onChange={setProxyEnable}>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label className="text-sm">{t('general.proxy_enable')}</Label>
                        </Switch.Content>
                    </Switch>
                    {proxyEnable && (
                        <div className="flex gap-2">
                            <TextField
                                value={proxyHost as string}
                                onChange={setProxyHost}
                                className="flex-1"
                            >
                                <Label>{t('general.proxy_host')}</Label>
                                <TextField.Input />
                            </TextField>
                            <TextField
                                value={proxyPort as string}
                                onChange={setProxyPort}
                                className="w-24"
                            >
                                <Label>{t('general.proxy_port')}</Label>
                                <TextField.Input />
                            </TextField>
                        </div>
                    )}
                </Card.Content>
            </Card>
        </div>
    )
}
