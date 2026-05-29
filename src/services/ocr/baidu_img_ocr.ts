import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { md5 } from '@/lib/crypto'
import { fetch_with_timeout } from '../fetch_timeout'

const BAIDU_IMG_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi'
]

const BAIDU_IMG_LANG_MAP: Record<string, string> = {
    auto: 'zh',
    zh_cn: 'zh',
    zh_tw: 'cht',
    en: 'en',
    ja: 'jp',
    ko: 'kor',
    fr: 'fra',
    es: 'spa',
    ru: 'ru',
    de: 'de',
    it: 'it',
    tr: 'tr',
    pt_pt: 'pt',
    pt_br: 'pt',
    vi: 'vie',
    id: 'id',
    th: 'th',
    ms: 'may',
    ar: 'ara',
    hi: 'hi'
}

export const baiduImgOcrService: OcrService = {
    key: 'baidu_img_ocr',
    name: 'Baidu Image OCR',
    languages: BAIDU_IMG_LANGUAGES,

    async recognize(
        base64Image: string,
        language: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const appid = config.appid as string
        const secret = config.secret as string

        const to_lang = BAIDU_IMG_LANG_MAP[language] ?? 'zh'

        const binary = Uint8Array.from(atob(base64Image), (c) => c.charCodeAt(0))
        let binary_string = ''
        for (let i = 0; i < binary.length; i++) {
            binary_string += String.fromCharCode(binary[i] ?? 0)
        }
        const file_md5 = md5(binary_string)

        const salt = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
        const sign = md5(appid + file_md5 + salt + 'APICUIDmac' + secret)

        const blob = new Blob([binary], { type: 'image/png' })
        const form = new FormData()
        form.append('image', blob, 'image.png')
        form.append('from', 'auto')
        form.append('to', to_lang)
        form.append('appid', appid)
        form.append('salt', salt)
        form.append('cuid', 'APICUID')
        form.append('mac', 'mac')
        form.append('version', '3')
        form.append('sign', sign)

        const resp = await fetch_with_timeout('https://fanyi-api.baidu.com/api/trans/sdk/picture', {
            method: 'POST',
            body: form
        })

        if (!resp.ok) {
            throw new Error(`Baidu Image OCR API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            data?: { sumSrc?: string; sumDst?: string }
            error_code?: number | string
            error_msg?: string
        }

        if (data.error_code) {
            throw new Error(`Baidu Image OCR error: ${String(data.error_msg ?? data.error_code)}`)
        }

        if (language === 'auto') {
            return data.data?.sumSrc?.trim() ?? ''
        }
        return data.data?.sumDst?.trim() ?? ''
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        try {
            await this.recognize(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                'auto',
                config
            )
            return true
        } catch {
            return false
        }
    }
}
