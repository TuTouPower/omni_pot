import React, { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfig } from '../../hooks/use_config'

interface SourceAreaProps {
    onTranslate: () => void
    inputRef?: React.RefObject<HTMLTextAreaElement | null>
}

type CaseFormat = 'snake' | 'screaming_snake' | 'kebab' | 'dot' | 'space' | 'title' | 'camel' | 'pascal'

const CASE_CYCLE: CaseFormat[] = ['snake', 'screaming_snake', 'kebab', 'dot', 'space', 'title', 'camel', 'pascal']

function detect_current_format(text: string): CaseFormat {
    if (text.includes('_') && text === text.toUpperCase()) return 'screaming_snake'
    if (text.includes('_')) return 'snake'
    if (text.includes('-')) return 'kebab'
    if (text.includes('.') && !text.includes(' ')) return 'dot'
    if (text.includes(' ') && /^(?:[A-Z][a-z]* )*[A-Z][a-z]*$/.test(text)) return 'title'
    if (text.includes(' ')) return 'space'
    if (/^[A-Z]/.test(text) && /[a-z]/.test(text) && !text.includes('_') && !text.includes('-') && !text.includes(' ')) return 'pascal'
    if (text === text.toUpperCase() && text.length > 1) return 'screaming_snake'
    if (/^[a-z]/.test(text) && /[A-Z]/.test(text)) return 'camel'
    return 'snake'
}

function split_words(text: string): string[] {
    if (text.includes('_')) return text.split('_').filter(Boolean)
    if (text.includes('-')) return text.split('-').filter(Boolean)
    if (text.includes('.')) return text.split('.').filter(Boolean)
    if (text.includes(' ')) return text.split(/\s+/).filter(Boolean)
    return text.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/).filter(Boolean)
}

function apply_format(words: string[], format: CaseFormat): string {
    const lower = words.map((w) => w.toLowerCase())
    switch (format) {
        case 'snake': return lower.join('_')
        case 'screaming_snake': return lower.join('_').toUpperCase()
        case 'kebab': return lower.join('-')
        case 'dot': return lower.join('.')
        case 'space': return lower.join(' ')
        case 'title': return lower.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        case 'camel': return lower.map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('')
        case 'pascal': return lower.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
    }
}

function cycle_variable_name(text: string): string {
    const current = detect_current_format(text)
    const idx = CASE_CYCLE.indexOf(current)
    const next = CASE_CYCLE[(idx + 1) % CASE_CYCLE.length]
    const words = split_words(text)
    return apply_format(words, next)
}

export function SourceArea({ onTranslate, inputRef }: SourceAreaProps): React.ReactElement | null {
    const { t } = useTranslation()
    const sourceText = useTranslateStore((s) => s.sourceText)
    const setSourceText = useTranslateStore((s) => s.setSourceText)
    const detectedLanguage = useTranslateStore((s) => s.detectedLanguage)
    const [hideSource] = useConfig('hide_source')
    const [dynamicTranslate] = useConfig('dynamic_translate')

    const internalRef = useRef<HTMLTextAreaElement>(null)
    const textAreaRef = inputRef ?? internalRef

    const handleVariableCycle = useCallback(() => {
        const textarea = textAreaRef.current
        if (!textarea) return
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        if (start === end) return
        const selected = sourceText.substring(start, end)
        const transformed = cycle_variable_name(selected)
        const newText = sourceText.substring(0, start) + transformed + sourceText.substring(end)
        setSourceText(newText)
    }, [sourceText, setSourceText, textAreaRef])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'U' && e.altKey && e.shiftKey) {
                e.preventDefault()
                handleVariableCycle()
                return
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onTranslate()
            }
        },
        [onTranslate, handleVariableCycle]
    )

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(sourceText)
    }, [sourceText])

    const handleDeleteNewline = useCallback(() => {
        setSourceText(sourceText.replace(/-\s+/g, '').replace(/\s+/g, ' '))
    }, [sourceText, setSourceText])

    const handleClear = useCallback(() => {
        setSourceText('')
    }, [setSourceText])

    useEffect(() => {
        if (!dynamicTranslate || !sourceText.trim()) return
        const timer = setTimeout(() => {
            onTranslate()
        }, 1000)
        return () => clearTimeout(timer)
    }, [sourceText, dynamicTranslate, onTranslate])

    if (hideSource) return null

    return (
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: '0 0 auto', minHeight: 120 }}>
            {/* Text area */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px 6px', minHeight: 0 }}>
                <textarea
                    ref={textAreaRef}
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('source_placeholder')}
                    data-testid="source-input"
                    style={{
                        width: '100%',
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        color: 'var(--text)',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'inherit',
                    }}
                    rows={3}
                />
            </div>
            {/* Action bar */}
            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px 8px' }}>
                {detectedLanguage && (
                    <span data-testid="detected-lang" style={{ fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', paddingLeft: 4 }}>
                        检测为 <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{detectedLanguage}</span>
                    </span>
                )}
                <div style={{ flex: 1 }} />
                <button className="ic-btn" title={t('delete_newline') || '去除换行'} data-testid="source-newline-btn" onClick={handleDeleteNewline}>
                    <Icons.Newline size={16} />
                </button>
                <button className="ic-btn" title={t('copy') || '复制原文'} data-testid="source-copy-btn" onClick={handleCopy}>
                    <Icons.Copy size={16} />
                </button>
                <button className="ic-btn" title={t('clear') || '清空'} data-testid="source-clear-btn" onClick={handleClear}>
                    <Icons.Trash size={16} />
                </button>
                <button className="ic-btn brand" title={t('translate') || '翻译'} data-testid="source-translate-btn" onClick={onTranslate} style={{ color: 'var(--brand-primary)' }}>
                    <Icons.Translate size={18} />
                </button>
            </div>
        </div>
    )
}
