import React from 'react'
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

export default function GeneralPage(): React.ReactElement {
    const [appTheme, setAppTheme] = useConfig('app_theme')
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
            <h3 className="text-xl font-bold">General</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">App Settings</h4>
                    <Switch isSelected={checkUpdate} onChange={setCheckUpdate}>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label className="text-sm">Check for updates on startup</Label>
                        </Switch.Content>
                    </Switch>
                    <Switch isSelected={autoStart} onChange={setAutoStart}>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label className="text-sm">Auto start on login</Label>
                        </Switch.Content>
                    </Switch>
                    <SimpleSelect label="Tray click action" value={trayClickEvent as string} onChange={(v) => setTrayClickEvent(v)} options={TRAY_CLICK_OPTIONS} />
                    <NumberField
                        value={serverPort}
                        onChange={(v) => { if (typeof v === 'number') setServerPort(v) }}
                        minValue={0}
                        maxValue={65535}
                    >
                        <Label>Server Port</Label>
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
                    <h4 className="font-semibold">Appearance</h4>
                    <SimpleSelect label="Theme" value={appTheme as string} onChange={(v) => setAppTheme(v)} options={THEME_OPTIONS} />
                    <SimpleSelect label="Font Size" value={String(fontSize)} onChange={(v) => setFontSize(Number(v))} options={FONT_SIZE_OPTIONS} />
                    <Switch isSelected={transparent} onChange={setTransparent}>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label className="text-sm">Transparent background</Label>
                        </Switch.Content>
                    </Switch>
                    <Switch isSelected={devMode} onChange={setDevMode}>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label className="text-sm">Developer mode (F12)</Label>
                        </Switch.Content>
                    </Switch>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Proxy</h4>
                    <Switch isSelected={proxyEnable} onChange={setProxyEnable}>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label className="text-sm">Enable proxy (requires restart)</Label>
                        </Switch.Content>
                    </Switch>
                    {proxyEnable && (
                        <div className="flex gap-2">
                            <TextField
                                value={proxyHost as string}
                                onChange={setProxyHost}
                                className="flex-1"
                            >
                                <Label>Host</Label>
                                <TextField.Input />
                            </TextField>
                            <TextField
                                value={proxyPort as string}
                                onChange={setProxyPort}
                                className="w-24"
                            >
                                <Label>Port</Label>
                                <TextField.Input />
                            </TextField>
                        </div>
                    )}
                </Card.Content>
            </Card>
        </div>
    )
}
