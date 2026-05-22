import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfig } from '../../hooks/use_config'
import { ConfigCard, ConfigRow } from './config_components'
import { format_hotkey } from '../../utils/format_hotkey'

interface HotkeyFieldProps {
    label: string
    sub?: string
    configKey: 'hotkey_translate' | 'hotkey_ocr_recognize' | 'hotkey_ocr_translate' | 'hotkey_selection_dictionary'
    activeField: string | null
    onStartCapture: (key: string) => void
}

function keyFromCode(code: string, fallback: string): string {
    if (code.startsWith('Digit')) return code.slice(5)
    if (code.startsWith('Key')) return code.slice(3)
    if (code.startsWith('Numpad')) return 'Num' + code.slice(6)
    if (code === 'Space') return 'Space'
    if (code.startsWith('Arrow')) return code
    if (code.startsWith('F') && /^F\d+$/.test(code)) return code
    const map: Record<string, string> = {
        Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
        Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',',
        Period: '.', Slash: '/', Backquote: '`',
    }
    if (map[code]) return map[code]
    return fallback.length === 1 ? fallback.toUpperCase() : fallback
}

function buildAccelerator(e: React.KeyboardEvent): string {
    const parts: string[] = []
    if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')

    const ignored = new Set(['Control', 'Shift', 'Alt', 'Meta'])
    if (!ignored.has(e.key)) {
        const key = keyFromCode(e.code, e.key)
        if (key) parts.push(key)
    }

    return parts.join('+')
}

function HotkeyField({ label, sub, configKey, activeField, onStartCapture }: HotkeyFieldProps): React.ReactElement {
    const { t } = useTranslation()
    const [currentValue, setCurrentValue] = useConfig(configKey)
    const [tempValue, setTempValue] = useState('')
    const [status, setStatus] = useState('')
    const fieldRef = useRef<HTMLDivElement>(null)

    const capturing = activeField === configKey

    useEffect(() => {
        if (capturing && fieldRef.current) {
            fieldRef.current.focus()
        }
    }, [capturing])

    // Reset temp value when this field loses capturing state
    useEffect(() => {
        if (!capturing) {
            setTempValue('')
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
                setStatus('')
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
        onStartCapture('') // exit capturing
    }

    const handleCancel = (): void => {
        onStartCapture('') // exit capturing
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
                    <button className="btn sm" data-testid={`cfg-${configKey}-bind`} onClick={() => { onStartCapture(configKey); setStatus('') }}>
                        {currentValue ? t('ui.unbind', { defaultValue: '解绑' }) : t('ui.set', { defaultValue: '绑定' })}
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
    const [activeField, setActiveField] = useState<string | null>(null)

    const handleStartCapture = (key: string): void => {
        setActiveField(key || null)
    }

    return (
        <div className="stack gap-12">
            <ConfigCard title={t('hotkey.title', { defaultValue: '快捷键' })} hint="按下组合键以录入 · Backspace 清除">
                <HotkeyField
                    label={t('hotkey.translate', { defaultValue: '翻译' })}
                    sub={"选中文本时翻译该文本\n未选中时弹出空翻译窗口\n剪贴板监听开启时自动翻译剪贴板新文本"}
                    configKey="hotkey_translate"
                    activeField={activeField}
                    onStartCapture={handleStartCapture}
                />
                <HotkeyField
                    label={t('hotkey.screenshot_recognize', { defaultValue: '文字识别' })}
                    sub="截图后将文字提取到识别窗口"
                    configKey="hotkey_ocr_recognize"
                    activeField={activeField}
                    onStartCapture={handleStartCapture}
                />
                <HotkeyField
                    label={t('hotkey.screenshot_translate', { defaultValue: '截图翻译' })}
                    sub="截图、识别并自动翻译"
                    configKey="hotkey_ocr_translate"
                    activeField={activeField}
                    onStartCapture={handleStartCapture}
                />
                <HotkeyField
                    label={t('hotkey.selection_dictionary', { defaultValue: '词典' })}
                    sub="选中文本后按下快捷键查词典"
                    configKey="hotkey_selection_dictionary"
                    activeField={activeField}
                    onStartCapture={handleStartCapture}
                />
            </ConfigCard>
        </div>
    )
}
