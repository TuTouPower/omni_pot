import React, { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Chip } from '@heroui/react'
import { HiTranslate } from 'react-icons/hi'
import { MdContentCopy, MdSmartButton, MdTextRotateUp } from 'react-icons/md'
import { LuDelete } from 'react-icons/lu'
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
    <div className="flex flex-col p-2 gap-1">
      <div className="relative">
        <textarea
          ref={textAreaRef}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('source_placeholder')}
          rows={3}
          className="w-full bg-default-100 border border-default-200 rounded-md px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary"
        />
        {detectedLanguage && (
          <Chip size="sm" color="primary" variant="flat" className="absolute top-1 right-1">
            {detectedLanguage}
          </Chip>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button isIconOnly size="sm" variant="light" onPress={onTranslate}>
          <HiTranslate className="text-lg" />
        </Button>
        <Button isIconOnly size="sm" variant="light" onPress={handleCopy} isDisabled={!sourceText}>
          <MdContentCopy className="text-lg" />
        </Button>
        <Button isIconOnly size="sm" variant="light" onPress={handleDeleteNewline} isDisabled={!sourceText}>
          <MdSmartButton className="text-lg" />
        </Button>
        <Button isIconOnly size="sm" variant="light" onPress={handleVariableCycle} isDisabled={!sourceText}>
          <MdTextRotateUp className="text-lg" />
        </Button>
        <div className="flex-1" />
        <Button isIconOnly size="sm" variant="light" onPress={handleClear} isDisabled={!sourceText}>
          <LuDelete className="text-lg" />
        </Button>
      </div>
    </div>
  )
}
