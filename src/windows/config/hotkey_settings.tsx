import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Input, Label } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'

interface HotkeyFieldProps {
    label: string
    configKey: 'hotkey_selection_translate' | 'hotkey_input_translate' | 'hotkey_ocr_recognize' | 'hotkey_ocr_translate' | 'hotkey_selection_dictionary'
}

function buildAccelerator(e: React.KeyboardEvent): string {
    const parts: string[] = []
    if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')

    const ignored = new Set(['Control', 'Shift', 'Alt', 'Meta'])
    let key = e.key
    if (key === ' ') key = 'Space'
    if (key.length === 1) key = key.toUpperCase()

    if (!ignored.has(e.key) && key) {
        parts.push(key)
    }

    return parts.join('+')
}

function HotkeyField({ label, configKey }: HotkeyFieldProps): React.ReactElement {
    const { t } = useTranslation()
    const [currentValue, setCurrentValue] = useConfig(configKey)
    const [capturing, setCapturing] = useState(false)
    const [tempValue, setTempValue] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (capturing && inputRef.current) {
            inputRef.current.focus()
        }
    }, [capturing])

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        e.preventDefault()
        e.stopPropagation()

        if (e.key === 'Backspace') {
            setTempValue('')
            return
        }

        const acc = buildAccelerator(e)
        if (acc.includes('+') && acc.split('+').length >= 2) {
            setTempValue(acc)
        }
    }

    const handleConfirm = async (): Promise<void> => {
        if (tempValue) {
            await window.electronAPI.hotkey.register(configKey, tempValue)
            setCurrentValue(tempValue)
        } else {
            await window.electronAPI.hotkey.unregister(configKey, currentValue)
            setCurrentValue('')
        }
        setCapturing(false)
        setTempValue('')
    }

    const handleCancel = (): void => {
        setCapturing(false)
        setTempValue('')
    }

    return (
        <div className="flex items-center gap-3">
            <Label className="text-sm min-w-[120px]">{label}</Label>
            <Input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                className="flex-1"
                value={capturing ? (tempValue || t('ui.press_shortcut')) : (currentValue || t('ui.not_set'))}
                readOnly
                onKeyDown={capturing ? handleKeyDown : undefined}
                onFocus={() => { if (capturing) return }}
                tabIndex={0}
            />
            {!capturing ? (
                <Button size="sm" onPress={() => { setCapturing(true); setTempValue('') }}>
                    {t('ui.set')}
                </Button>
            ) : (
                <>
                    <Button size="sm" color="primary" onPress={handleConfirm}>
                        {t('ui.ok')}
                    </Button>
                    <Button size="sm" variant="ghost" onPress={handleCancel}>
                        {t('ui.cancel')}
                    </Button>
                </>
            )}
        </div>
    )
}

export default function HotkeySettings(): React.ReactElement {
    const { t } = useTranslation()
    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">{t('hotkey.title')}</h3>

            <Card>
                <Card.Content className="gap-4 p-4">
                    <HotkeyField label={t('hotkey.selection_translate')} configKey="hotkey_selection_translate" />
                    <HotkeyField label={t('hotkey.input_translate')} configKey="hotkey_input_translate" />
                    <HotkeyField label={t('hotkey.screenshot_recognize')} configKey="hotkey_ocr_recognize" />
                    <HotkeyField label={t('hotkey.screenshot_translate')} configKey="hotkey_ocr_translate" />
                    <HotkeyField label={t('hotkey.selection_dictionary')} configKey="hotkey_selection_dictionary" />
                </Card.Content>
            </Card>
        </div>
    )
}
