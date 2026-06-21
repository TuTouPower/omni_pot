import React from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { Dropdown } from '../../components/dropdown'
import { useTranslateStore } from '../../stores/translate_store'
import { native_language_name } from '../../i18n/language_names'
import { LANGUAGE_CODES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'

const SOURCE_LANGUAGES: LanguageCode[] = ['auto', ...LANGUAGE_CODES.filter((c) => c !== 'auto')]
const TARGET_LANGUAGES: LanguageCode[] = LANGUAGE_CODES.filter((c) => c !== 'auto')

const LangPick = React.memo(function LangPick({ value, onChange, options, testId, optionTestIdPrefix }: {
    value: LanguageCode
    onChange: (v: LanguageCode) => void
    options: string[]
    testId: string
    optionTestIdPrefix: string
}): React.ReactElement {
    const { t } = useTranslation()
    const dropdown_options = options.map((code) => ({ value: code, label: native_language_name(t, code as LanguageCode) }))

    return (
        <Dropdown
            value={value}
            options={dropdown_options}
            onChange={(v) => { onChange(v as LanguageCode) }}
            testId={testId}
            optionTestIdPrefix={optionTestIdPrefix}
        />
    )
})

interface LanguageAreaProps {
    onSwap: () => void
    containerRef?: React.Ref<HTMLDivElement>
}

const LanguageArea_ = function LanguageArea({ onSwap, containerRef }: LanguageAreaProps): React.ReactElement {
    const { t } = useTranslation()
    const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
    const targetLanguage = useTranslateStore((s) => s.targetLanguage)
    const effectiveTargetLanguage = useTranslateStore((s) => s.effectiveTargetLanguage)
    const setSourceLanguage = useTranslateStore((s) => s.setSourceLanguage)
    const setTargetLanguage = useTranslateStore((s) => s.setTargetLanguage)
    const setLockedTargetLanguage = useTranslateStore((s) => s.setLockedTargetLanguage)
    const detectedLanguage = useTranslateStore((s) => s.detectedLanguage)
    const autoNoDetect = sourceLanguage === 'auto' && !detectedLanguage

    return (
        <div ref={containerRef} className="card" style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flex: '0 0 auto' }}>
            <div data-testid="lang-source">
                <LangPick value={sourceLanguage} onChange={setSourceLanguage} options={SOURCE_LANGUAGES} testId="lang-source-button" optionTestIdPrefix="lang-source-option" />
            </div>
            <button className="ic-btn" style={{ color: autoNoDetect ? 'var(--text-mute)' : 'var(--text)', cursor: autoNoDetect ? 'not-allowed' : 'pointer' }} title={autoNoDetect ? t('auto_detect_no_swap') : t('swap_languages')} data-testid="lang-swap" onClick={onSwap} disabled={autoNoDetect}>
                <Icons.Swap size={18} />
            </button>
            <div data-testid="lang-target">
                <LangPick value={effectiveTargetLanguage ?? targetLanguage} onChange={(lang) => { setTargetLanguage(lang); setLockedTargetLanguage(lang); }} options={TARGET_LANGUAGES} testId="lang-target-button" optionTestIdPrefix="lang-target-option" />
            </div>
        </div>
    )
}
export const LanguageArea = React.memo(LanguageArea_)
