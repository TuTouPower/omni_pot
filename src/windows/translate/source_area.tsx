import React, { useCallback } from 'react'
import { TextArea, Button, Chip } from '@heroui/react'
import { HiTranslate } from 'react-icons/hi'
import { MdContentCopy, MdSmartButton } from 'react-icons/md'
import { LuDelete } from 'react-icons/lu'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfig } from '../../hooks/use_config'

interface SourceAreaProps {
  onTranslate: () => void
}

export function SourceArea({ onTranslate }: SourceAreaProps): React.ReactElement | null {
  const sourceText = useTranslateStore((s) => s.sourceText)
  const setSourceText = useTranslateStore((s) => s.setSourceText)
  const detectedLanguage = useTranslateStore((s) => s.detectedLanguage)
  const [hideSource] = useConfig('hide_source')

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

  if (hideSource) return null

  return (
    <div className="flex flex-col p-2 gap-1">
      <div className="relative">
        <TextArea
          value={sourceText}
          onChange={setSourceText}
          onKeyDown={handleKeyDown}
          placeholder="Enter text to translate..."
          className="text-sm"
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
