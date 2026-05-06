import React from 'react'
import { Select, ListBoxItem, Button } from '@heroui/react'
import { BiTransferAlt } from 'react-icons/bi'
import { useTranslateStore } from '../../stores/translate_store'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'

const SOURCE_LANGUAGES = ['auto', ...LANGUAGE_CODES.filter((c) => c !== 'auto')]
const TARGET_LANGUAGES = LANGUAGE_CODES.filter((c) => c !== 'auto')

export function LanguageArea(): React.ReactElement {
  const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
  const targetLanguage = useTranslateStore((s) => s.targetLanguage)
  const setSourceLanguage = useTranslateStore((s) => s.setSourceLanguage)
  const setTargetLanguage = useTranslateStore((s) => s.setTargetLanguage)
  const swapLanguages = useTranslateStore((s) => s.swapLanguages)

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <Select
        selectedKey={sourceLanguage}
        onSelectionChange={(key) => setSourceLanguage(key as LanguageCode)}
        className="flex-1"
        aria-label="Source language"
      >
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Popover>
          {SOURCE_LANGUAGES.map((code) => (
            <ListBoxItem key={code} id={code} textValue={LANGUAGE_NAMES[code]}>
              {LANGUAGE_NAMES[code]}
            </ListBoxItem>
          ))}
        </Select.Popover>
      </Select>
      <Button isIconOnly size="sm" variant="light" onPress={swapLanguages}>
        <BiTransferAlt className="text-lg" />
      </Button>
      <Select
        selectedKey={targetLanguage}
        onSelectionChange={(key) => setTargetLanguage(key as LanguageCode)}
        className="flex-1"
        aria-label="Target language"
      >
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Popover>
          {TARGET_LANGUAGES.map((code) => (
            <ListBoxItem key={code} id={code} textValue={LANGUAGE_NAMES[code]}>
              {LANGUAGE_NAMES[code]}
            </ListBoxItem>
          ))}
        </Select.Popover>
      </Select>
    </div>
  )
}
