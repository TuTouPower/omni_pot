import React from 'react'
import { Card, Input, Label, ListBox, NumberField, Select, Switch, TextField } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'

const THEME_OPTIONS = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' }
]

const FONT_SIZE_OPTIONS = [10, 12, 14, 16, 18, 20, 24]

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
                    <Select
                        className="w-full"
                        value={appTheme}
                        onChange={(v) => { if (v != null) setAppTheme(v as 'system' | 'light' | 'dark') }}
                    >
                        <Label>Theme</Label>
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {THEME_OPTIONS.map((opt) => (
                                    <ListBox.Item key={opt.key} id={opt.key} textValue={opt.label}>
                                        {opt.label}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                    <Select
                        className="w-full"
                        value={String(fontSize)}
                        onChange={(v) => { if (v != null) setFontSize(Number(v)) }}
                    >
                        <Label>Font Size</Label>
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {FONT_SIZE_OPTIONS.map((size) => (
                                    <ListBox.Item key={String(size)} id={String(size)} textValue={`${size}px`}>
                                        {`${size}px`}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
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
