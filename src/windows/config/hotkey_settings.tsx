import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfig } from '../../hooks/use_config'
import { Icons } from '../../components/icons'
import { ConfigCard, ConfigRow } from './config_components'
import { format_hotkey } from '../../utils/format_hotkey'

interface HotkeyFieldProps {
    label: string
    sub?: string
    configKey: 'hotkey_translate' | 'hotkey_ocr_recognize' | 'hotkey_ocr_translate' | 'hotkey_selection_dictionary'
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

function HotkeyField({ label, sub, configKey }: HotkeyFieldProps): React.ReactElement {
    const { t } = useTranslation()
    const [currentValue, setCurrentValue] = useConfig(configKey)
    const [capturing, setCapturing] = useState(false)
    const [tempValue, setTempValue] = useState('')
    const [status, setStatus] = useState('')
    const fieldRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (capturing && fieldRef.current) {
            fieldRef.current.focus()
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
            const result = await window.electronAPI.hotkey.register(configKey, tempValue)
            if (result.success) {
                if (currentValue && currentValue !== tempValue) {
                    await window.electronAPI.hotkey.unregister(configKey, currentValue)
                }
                setCurrentValue(tempValue)
                setStatus('绑定成功')
            } else if (result.reason === 'conflict') {
                setStatus('快捷键冲突')
            } else {
                setStatus('绑定失败')
            }
        } else {
            await window.electronAPI.hotkey.unregister(configKey, currentValue)
            setCurrentValue('')
            setStatus('已清除')
        }
        setCapturing(false)
        setTempValue('')
    }

    const handleCancel = (): void => {
        setCapturing(false)
        setTempValue('')
    }

    const displayValue = capturing ? tempValue : currentValue

    return (
        <ConfigRow label={label} sub={sub} testId={`cfg-${configKey}`}>
            <div style={{ display: 'flex', gap: 6 }}>
                <div
                    className="field"
                    ref={fieldRef}
                    data-testid={`cfg-${configKey}-field`}
                    style={{ minWidth: 200, gap: 4 }}
                    tabIndex={0}
                    onKeyDown={capturing ? handleKeyDown : undefined}
                >
                    {displayValue ? (
                        format_hotkey(displayValue).map((k, i, a) => (
                            <React.Fragment key={i}>
                                <kbd>{k}</kbd>
                                {i < a.length - 1 && <span className="hint"> + </span>}
                            </React.Fragment>
                        ))
                    ) : (
                        <span className="hint">{capturing ? t('ui.press_shortcut', { defaultValue: '按下组合键…' }) : t('ui.not_set', { defaultValue: '未设置' })}</span>
                    )}
                </div>
                {!capturing ? (
                    <button className="btn sm" data-testid={`cfg-${configKey}-bind`} onClick={() => { setCapturing(true); setTempValue(''); setStatus('') }}>
                        {currentValue ? <><Icons.Check size={12} /> {t('ui.unbind', { defaultValue: '解绑' })}</> : t('ui.set', { defaultValue: '绑定' })}
                    </button>
                ) : (
                    <>
                        <button className="btn sm primary" data-testid={`cfg-${configKey}-confirm`} onClick={() => { handleConfirm().catch(console.error); }}>{t('ui.ok', { defaultValue: '确认' })}</button>
                        <button className="btn sm ghost" data-testid={`cfg-${configKey}-cancel`} onClick={handleCancel}>{t('ui.cancel', { defaultValue: '取消' })}</button>
                    </>
                )}
                {status && <span className="hint" data-testid={`cfg-${configKey}-status`}>{status}</span>}
            </div>
        </ConfigRow>
    )
}

export default function HotkeySettings(): React.ReactElement {
    const { t } = useTranslation()
    return (
        <div className="stack gap-12">
            <ConfigCard title={t('hotkey.title', { defaultValue: '快捷键' })} hint="按下组合键以录入 · Backspace 清除">
                <HotkeyField
                    label={t('hotkey.translate', { defaultValue: '翻译' })}
                    sub="选中文本则直接翻译，无选中则打开输入窗口"
                    configKey="hotkey_translate"
                />
                <HotkeyField
                    label={t('hotkey.screenshot_recognize', { defaultValue: '文字识别' })}
                    sub="截图后将文字提取到识别窗口"
                    configKey="hotkey_ocr_recognize"
                />
                <HotkeyField
                    label={t('hotkey.screenshot_translate', { defaultValue: '截图翻译' })}
                    sub="截图、识别并自动翻译"
                    configKey="hotkey_ocr_translate"
                />
                <HotkeyField
                    label={t('hotkey.selection_dictionary', { defaultValue: '词典' })}
                    sub="选中文本后按下快捷键查词典"
                    configKey="hotkey_selection_dictionary"
                />
            </ConfigCard>
        </div>
    )
}
