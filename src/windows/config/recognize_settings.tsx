import React from 'react'
import { Card, Label, Switch } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'
import { SimpleSelect } from '../../components/simple_select'

const ALL_LANGUAGES = LANGUAGE_CODES.map((code) => ({ key: code, label: LANGUAGE_NAMES[code] }))

export default function RecognizeSettings(): React.ReactElement {
    const [language, setLanguage] = useConfig('recognize_language')
    const [deleteNewline, setDeleteNewline] = useConfig('recognize_delete_newline')
    const [autoCopy, setAutoCopy] = useConfig('recognize_auto_copy')
    const [closeOnBlur, setCloseOnBlur] = useConfig('recognize_close_on_blur')
    const [hideWindow, setHideWindow] = useConfig('recognize_hide_window')

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">Recognize</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Language</h4>
                    <SimpleSelect label="OCR Language" value={language} onChange={setLanguage} options={ALL_LANGUAGES} />
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Behavior</h4>
                    <Switch isSelected={deleteNewline} onChange={setDeleteNewline}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">Delete newlines</Label></Switch.Content>
                    </Switch>
                    <Switch isSelected={autoCopy} onChange={setAutoCopy}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">Auto copy result</Label></Switch.Content>
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
                    <Switch isSelected={hideWindow} onChange={setHideWindow}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">Hide window after recognize</Label></Switch.Content>
                    </Switch>
                </Card.Content>
            </Card>
        </div>
    )
}
