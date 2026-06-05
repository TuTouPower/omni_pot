import type { TFunction } from 'i18next'
import { LANGUAGE_NAMES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'

const NATIVE_LANGUAGE_NAME_OVERRIDES: Partial<Record<LanguageCode, string>> = {
    en: 'English',
}

function language_name(t: TFunction, code: LanguageCode): string {
    return t(`languages.${code}`, { defaultValue: LANGUAGE_NAMES[code] })
}

export function native_language_name(t: TFunction, code: LanguageCode): string {
    if (code === 'auto') return language_name(t, code)
    return NATIVE_LANGUAGE_NAME_OVERRIDES[code] ?? LANGUAGE_NAMES[code]
}

export function native_language_options(t: TFunction, codes: readonly LanguageCode[]): Array<{ value: LanguageCode; label: string }> {
    return codes.map((code) => ({ value: code, label: native_language_name(t, code) }))
}
