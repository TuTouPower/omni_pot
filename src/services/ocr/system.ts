import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'

const WINDOWS_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'fa', 'pl', 'nl', 'uk'
]

const MACOS_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'pt_pt', 'pt_br'
]

function get_platform_languages(): LanguageCode[] {
    const platform = navigator.platform.toLowerCase()
    if (platform.startsWith('mac')) return MACOS_LANGUAGES
    return WINDOWS_LANGUAGES
}

const LANG_MAP: Record<string, string> = {
    auto: '',
    zh_cn: 'zh-CN',
    zh_tw: 'zh-TW',
    en: 'en-US',
    ja: 'ja-JP',
    ko: 'ko-KR',
    fr: 'fr-FR',
    es: 'es-ES',
    ru: 'ru-RU',
    de: 'de-DE',
    it: 'it-IT',
    tr: 'tr-TR',
    pt_pt: 'pt-PT',
    pt_br: 'pt-BR',
    vi: 'vi-VN',
    id: 'id-ID',
    th: 'th-TH',
    ms: 'ms-MY',
    ar: 'ar-SA',
    hi: 'hi-IN',
    fa: 'fa-IR',
    pl: 'pl-PL',
    nl: 'nl-NL',
    uk: 'uk-UA'
}

export const systemOcrService: OcrService = {
    key: 'system',
    name: 'System OCR',
    get languages() { return get_platform_languages() },

    async recognize(base64Image: string, language: LanguageCode): Promise<string> {
        const lang = LANG_MAP[language] ?? ''
        const result = await window.electronAPI.ocr.systemRecognize(base64Image, lang)
        return result
    },

    async testConfig(): Promise<boolean> {
        try {
            await window.electronAPI.ocr.systemRecognize('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'en-US')
            return true
        } catch {
            return false
        }
    }
}
