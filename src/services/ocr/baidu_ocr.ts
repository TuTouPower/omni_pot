import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'

const BAIDU_OCR_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'fa', 'pl', 'nl', 'uk'
]

const BAIDU_OCR_LANG_MAP: Record<string, string> = {
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

async function get_access_token(client_id: string, client_secret: string): Promise<string> {
    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`
    const resp = await fetch(url)
    if (!resp.ok) {
        throw new Error(`Baidu OCR token error: ${resp.status}`)
    }
    const data = (await resp.json()) as { access_token?: string; error?: string }
    if (!data.access_token) {
        throw new Error(`Baidu OCR token error: ${data.error ?? 'unknown'}`)
    }
    return data.access_token
}

export const baiduOcrService: OcrService = {
    key: 'baidu_ocr',
    name: 'Baidu OCR',
    languages: BAIDU_OCR_LANGUAGES,

    async recognize(
        base64Image: string,
        language: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const client_id = config.client_id as string
        const client_secret = config.client_secret as string
        const token = await get_access_token(client_id, client_secret)
        const lang = BAIDU_OCR_LANG_MAP[language] ?? 'CHN_ENG'

        const resp = await fetch(
            `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `image=${encodeURIComponent(base64Image)}&language_type=${lang}`
            }
        )

        if (!resp.ok) {
            throw new Error(`Baidu OCR API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            words_result?: Array<{ words: string }>
            error_code?: number | string
            error_msg?: string
        }

        if (data.error_code) {
            throw new Error(`Baidu OCR error: ${data.error_msg ?? data.error_code}`)
        }

        return data.words_result?.map((r) => r.words).join('\n') ?? ''
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        try {
            const client_id = config.client_id as string
            const client_secret = config.client_secret as string
            const token = await get_access_token(client_id, client_secret)
            return token.length > 0
        } catch {
            return false
        }
    }
}
