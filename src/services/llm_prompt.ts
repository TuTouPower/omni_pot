import type { ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

export function buildTranslationPrompt(config: ServiceConfig, from: LanguageCode, to: LanguageCode): string {
    const custom = config.promptList as string | undefined
    if (custom) return custom
    const source_lang = from === 'auto' ? 'auto-detect' : from
    const target_lang = to
    return `You are a professional translation engine. Translate the following text from ${source_lang} to ${target_lang}. Only output the translation result, nothing else.`
}
