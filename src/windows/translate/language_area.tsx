import React from 'react'
import { Button } from '@heroui/react'
import { BiTransferAlt } from 'react-icons/bi'
import { useTranslateStore } from '../../stores/translate_store'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'

const SOURCE_LANGUAGES = ['auto', ...LANGUAGE_CODES.filter((c) => c !== 'auto')]
const TARGET_LANGUAGES = LANGUAGE_CODES.filter((c) => c !== 'auto')

function LangSelect({ value, onChange, options }: {
    value: LanguageCode
    onChange: (v: LanguageCode) => void
    options: string[]
}): React.ReactElement {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value as LanguageCode)}
            className="flex-1 bg-default-100 border border-default-200 rounded px-2 py-1 text-sm outline-none"
        >
            {options.map((code) => (
                <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>
            ))}
        </select>
    )
}

export function LanguageArea(): React.ReactElement {
    const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
    const targetLanguage = useTranslateStore((s) => s.targetLanguage)
    const setSourceLanguage = useTranslateStore((s) => s.setSourceLanguage)
    const setTargetLanguage = useTranslateStore((s) => s.setTargetLanguage)
    const swapLanguages = useTranslateStore((s) => s.swapLanguages)

    return (
        <div className="flex items-center gap-2 px-3 py-1">
            <LangSelect value={sourceLanguage} onChange={setSourceLanguage} options={SOURCE_LANGUAGES} />
            <Button isIconOnly size="sm" variant="light" onPress={swapLanguages}>
                <BiTransferAlt className="text-lg" />
            </Button>
            <LangSelect value={targetLanguage} onChange={setTargetLanguage} options={TARGET_LANGUAGES} />
        </div>
    )
}
