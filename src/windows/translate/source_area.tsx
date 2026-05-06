import React, { useCallback, useEffect, useRef } from 'react'
import { Button, Chip } from '@heroui/react'
import { HiTranslate } from 'react-icons/hi'
import { MdContentCopy, MdSmartButton } from 'react-icons/md'
import { LuDelete } from 'react-icons/lu'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfig } from '../../hooks/use_config'

interface SourceAreaProps {
  onTranslate: () => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}

export function SourceArea({ onTranslate, inputRef }: SourceAreaProps): React.ReactElement | null {
  const sourceText = useTranslateStore((s) => s.sourceText)
  const setSourceText = useTranslateStore((s) => s.setSourceText)
  const detectedLanguage = useTranslateStore((s) => s.detectedLanguage)
  const [hideSource] = useConfig('hide_source')
  const [dynamicTranslate] = useConfig('dynamic_translate')

  const internalRef = useRef<HTMLTextAreaElement>(null)
  const textAreaRef = inputRef ?? internalRef

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onTranslate()
      }
    },
    [onTranslate]
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
          placeholder="Enter text to translate..."
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
        <div className="flex-1" />
        <Button isIconOnly size="sm" variant="light" onPress={handleClear} isDisabled={!sourceText}>
          <LuDelete className="text-lg" />
        </Button>
      </div>
    </div>
  )
}
