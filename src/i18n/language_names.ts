import type { TFunction } from 'i18next'
import { LANGUAGE_NAMES } from '@shared/types/language'
import type { LanguageCode } from '@shared/types/language'

export function language_name(t: TFunction, code: LanguageCode): string {
    return t(`languages.${code}`, { defaultValue: LANGUAGE_NAMES[code] })
}

export function language_options(t: TFunction, codes: readonly LanguageCode[]): Array<{ value: LanguageCode; label: string }> {
    return codes.map((code) => ({ value: code, label: language_name(t, code) }))
}
