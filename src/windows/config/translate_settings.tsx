import React from 'react'
import { Card, Label, Switch } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'
import { SimpleSelect } from '../../components/simple_select'

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
    const [rememberWindowSize, setRememberWindowSize] = useConfig('translate_remember_window_size')

    const allLangItems = ALL_LANGUAGES.map((code) => ({ key: code, label: LANGUAGE_NAMES[code] }))
    const targetLangItems = TARGET_LANGUAGES.map((code) => ({ key: code, label: LANGUAGE_NAMES[code] }))

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">Translate</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Language</h4>
                    <SimpleSelect label="Source Language" value={sourceLang} onChange={setSourceLang} options={allLangItems} />
                    <SimpleSelect label="Target Language" value={targetLang} onChange={setTargetLang} options={targetLangItems} />
                    <SimpleSelect label="Second Language" value={secondLang} onChange={setSecondLang} options={targetLangItems} />
                    <SimpleSelect label="Detect Engine" value={detectEngine} onChange={setDetectEngine} options={DETECT_ENGINES} />
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Behavior</h4>
                    <SimpleSelect label="Auto Copy" value={autoCopy} onChange={(v) => setAutoCopy(v)} options={AUTO_COPY_OPTIONS} />
                    <Switch isSelected={deleteNewline} onChange={setDeleteNewline}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">Delete newlines</Label></Switch.Content>
                    </Switch>
                    <Switch isSelected={incremental} onChange={setIncremental}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">Incremental translate</Label></Switch.Content>
                    </Switch>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Window</h4>
                    <Switch isSelected={closeOnBlur} onChange={setCloseOnBlur}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">Close on blur</Label></Switch.Content>
                    </Switch>
                    <Switch isSelected={alwaysOnTop} onChange={setAlwaysOnTop}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">Always on top</Label></Switch.Content>
                    </Switch>
                    <Switch isSelected={hideSource} onChange={setHideSource}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">Hide source text</Label></Switch.Content>
                    </Switch>
                    <Switch isSelected={hideLanguage} onChange={setHideLanguage}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">Hide language selector</Label></Switch.Content>
                    </Switch>
                    <Switch isSelected={rememberWindowSize} onChange={setRememberWindowSize}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">Remember window size</Label></Switch.Content>
                    </Switch>
                </Card.Content>
            </Card>
        </div>
    )
}
