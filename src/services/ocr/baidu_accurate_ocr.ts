import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { getAccessToken, recognizeWithBaiduOcr } from './baidu_common'

const BAIDU_ACCURATE_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'fa', 'pl', 'nl', 'uk'
]

const BAIDU_ACCURATE_LANG_MAP: Record<string, string> = {
    auto: 'CHN_ENG',
    zh_cn: 'CHN_ENG',
    zh_tw: 'CHN_ENG',
    en: 'ENG',
    ja: 'JAP',
    ko: 'KOR',
    fr: 'FRE',
    es: 'SPA',
    ru: 'RUS',
    de: 'GER',
    it: 'ITA',
    tr: 'CHN_ENG',
    pt_pt: 'POR',
    pt_br: 'POR',
    vi: 'CHN_ENG',
    id: 'CHN_ENG',
    th: 'CHN_ENG',
    ms: 'CHN_ENG',
    ar: 'CHN_ENG',
    hi: 'CHN_ENG',
    fa: 'CHN_ENG',
    pl: 'CHN_ENG',
    nl: 'CHN_ENG',
    uk: 'CHN_ENG'
}

export const baiduAccurateOcrService: OcrService = {
    key: 'baidu_accurate_ocr',
    name: 'Baidu Accurate OCR',
    languages: BAIDU_ACCURATE_LANGUAGES,

    async recognize(
        base64Image: string,
        language: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const lang = BAIDU_ACCURATE_LANG_MAP[language] ?? 'CHN_ENG'
        return recognizeWithBaiduOcr('accurate_basic', 'Baidu Accurate OCR', base64Image, lang, config, { detect_direction: 'true' })
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        try {
            const client_id = config.client_id as string
            const client_secret = config.client_secret as string
            const token = await getAccessToken(client_id, client_secret)
            return token.length > 0
        } catch {
            return false
        }
    }
}
