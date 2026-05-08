import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'

const SYSTEM_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'fa', 'pl', 'nl', 'uk'
]

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
    languages: SYSTEM_LANGUAGES,

    async recognize(base64Image: string, language: LanguageCode, _config: ServiceConfig): Promise<string> {
        const lang = LANG_MAP[language] ?? ''
        const result = await window.electronAPI.ocr.systemRecognize(base64Image, lang)
        return result
    },

    async testConfig(_config: ServiceConfig): Promise<boolean> {
        try {
            const result = await window.electronAPI.ocr.systemRecognize('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'en-US')
            return true
        } catch {
            return false
        }
    }
}
