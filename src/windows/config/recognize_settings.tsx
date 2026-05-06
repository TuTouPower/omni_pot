import React from 'react'
import { Card, Label, ListBox, Select, Switch } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'

const ALL_LANGUAGES = LANGUAGE_CODES

interface SelectFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    items: { key: string; label: string }[]
}

function SelectField({ label, value, onChange, items }: SelectFieldProps): React.ReactElement {
    return (
        <Select className="w-full" value={value} onChange={(v) => { if (v != null) onChange(String(v)) }}>
            <Label>{label}</Label>
            <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    {items.map((item) => (
                        <ListBox.Item key={item.key} id={item.key} textValue={item.label}>
                            {item.label}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    )
}

interface ToggleFieldProps {
    label: string
    isSelected: boolean
    onChange: (value: boolean) => void
}

function ToggleField({ label, isSelected, onChange }: ToggleFieldProps): React.ReactElement {
    return (
        <Switch isSelected={isSelected} onChange={onChange}>
            <Switch.Control>
                <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
                <Label className="text-sm">{label}</Label>
            </Switch.Content>
        </Switch>
    )
}

export default function RecognizeSettings(): React.ReactElement {
    const [language, setLanguage] = useConfig('recognize_language')
    const [deleteNewline, setDeleteNewline] = useConfig('recognize_delete_newline')
    const [autoCopy, setAutoCopy] = useConfig('recognize_auto_copy')
    const [closeOnBlur, setCloseOnBlur] = useConfig('recognize_close_on_blur')
    const [hideWindow, setHideWindow] = useConfig('recognize_hide_window')

    const langItems = ALL_LANGUAGES.map((code) => ({ key: code, label: LANGUAGE_NAMES[code] }))

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">Recognize</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Language</h4>
                    <SelectField
                        label="OCR Language"
                        value={language}
                        onChange={setLanguage}
                        items={langItems}
                    />
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Behavior</h4>
                    <ToggleField
                        label="Delete newlines"
                        isSelected={deleteNewline}
                        onChange={setDeleteNewline}
                    />
                    <ToggleField
                        label="Auto copy result"
                        isSelected={autoCopy}
                        onChange={setAutoCopy}
                    />
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Window</h4>
                    <ToggleField
                        label="Close on blur"
                        isSelected={closeOnBlur}
                        onChange={setCloseOnBlur}
                    />
                    <ToggleField
                        label="Hide window after recognize"
                        isSelected={hideWindow}
                        onChange={setHideWindow}
                    />
                </Card.Content>
            </Card>
        </div>
    )
}
