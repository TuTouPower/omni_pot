import React from 'react'
import { Card, Label, ListBox, Select, Switch } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'

const TARGET_LANGUAGES = LANGUAGE_CODES.filter((c) => c !== 'auto')
const ALL_LANGUAGES = LANGUAGE_CODES

const AUTO_COPY_OPTIONS = [
    { key: 'disable', label: 'Disable' },
    { key: 'source', label: 'Source text' },
    { key: 'target', label: 'Target text' },
    { key: 'source_target', label: 'Source + Target' }
]

const DETECT_ENGINES = [
    { key: 'bing', label: 'Bing' },
    { key: 'google', label: 'Google' },
    { key: 'local', label: 'Local (offline)' }
]

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

export default function TranslatePage(): React.ReactElement {
    const [sourceLang, setSourceLang] = useConfig('translate_source_language')
    const [targetLang, setTargetLang] = useConfig('translate_target_language')
    const [secondLang, setSecondLang] = useConfig('translate_second_language')
    const [detectEngine, setDetectEngine] = useConfig('translate_detect_engine')
    const [autoCopy, setAutoCopy] = useConfig('translate_auto_copy')
    const [deleteNewline, setDeleteNewline] = useConfig('translate_delete_newline')
    const [incremental, setIncremental] = useConfig('incremental_translate')
    const [closeOnBlur, setCloseOnBlur] = useConfig('translate_close_on_blur')
    const [alwaysOnTop, setAlwaysOnTop] = useConfig('translate_always_on_top')
    const [hideSource, setHideSource] = useConfig('hide_source')
    const [hideLanguage, setHideLanguage] = useConfig('hide_language')

    const allLangItems = ALL_LANGUAGES.map((code) => ({ key: code, label: LANGUAGE_NAMES[code] }))
    const targetLangItems = TARGET_LANGUAGES.map((code) => ({ key: code, label: LANGUAGE_NAMES[code] }))

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">Translate</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Language</h4>
                    <SelectField
                        label="Source Language"
                        value={sourceLang}
                        onChange={(v) => setSourceLang(v)}
                        items={allLangItems}
                    />
                    <SelectField
                        label="Target Language"
                        value={targetLang}
                        onChange={(v) => setTargetLang(v)}
                        items={targetLangItems}
                    />
                    <SelectField
                        label="Second Language"
                        value={secondLang}
                        onChange={(v) => setSecondLang(v)}
                        items={targetLangItems}
                    />
                    <SelectField
                        label="Detect Engine"
                        value={detectEngine}
                        onChange={(v) => setDetectEngine(v)}
                        items={DETECT_ENGINES}
                    />
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Behavior</h4>
                    <SelectField
                        label="Auto Copy"
                        value={autoCopy}
                        onChange={(v) => setAutoCopy(v as 'disable' | 'source' | 'target' | 'source_target')}
                        items={AUTO_COPY_OPTIONS}
                    />
                    <ToggleField
                        label="Delete newlines"
                        isSelected={deleteNewline}
                        onChange={setDeleteNewline}
                    />
                    <ToggleField
                        label="Incremental translate"
                        isSelected={incremental}
                        onChange={setIncremental}
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
                        label="Always on top"
                        isSelected={alwaysOnTop}
                        onChange={setAlwaysOnTop}
                    />
                    <ToggleField
                        label="Hide source text"
                        isSelected={hideSource}
                        onChange={setHideSource}
                    />
                    <ToggleField
                        label="Hide language selector"
                        isSelected={hideLanguage}
                        onChange={setHideLanguage}
                    />
                </Card.Content>
            </Card>
        </div>
    )
}
