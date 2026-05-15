import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { signTencentRequest } from '../tencent_sign'

const TENCENT_IMG_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi'
]

const TENCENT_IMG_LANG_MAP: Record<string, string> = {
    auto: 'zh',
    zh_cn: 'zh',
    zh_tw: 'zh-TW',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    fr: 'fr',
    es: 'es',
    ru: 'ru',
    de: 'de',
    it: 'it',
    tr: 'tr',
    pt_pt: 'pt',
    pt_br: 'pt',
    vi: 'vi',
    id: 'id',
    th: 'th',
    ms: 'ms',
    ar: 'ar',
    hi: 'hi'
}

export const tencentImgOcrService: OcrService = {
    key: 'tencent_img_ocr',
    name: 'Tencent Image OCR',
    languages: TENCENT_IMG_LANGUAGES,

    async recognize(
        base64Image: string,
        language: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const secretId = config.secret_id as string
        const secretKey = config.secret_key as string

        const target_lang = TENCENT_IMG_LANG_MAP[language] ?? 'zh'

        const body = JSON.stringify({
            SessionUuid: crypto.randomUUID().replace(/-/g, ''),
            Scene: 'doc',
            Data: base64Image,
            Source: 'auto',
            Target: target_lang,
            ProjectId: 0
        })

        const { headers } = await signTencentRequest({
            secretId, secretKey,
            host: 'tmt.tencentcloudapi.com',
            service: 'tmt', region: 'ap-beijing',
            action: 'ImageTranslate', version: '2018-03-21', body
        })

        const resp = await fetch('https://tmt.tencentcloudapi.com', {
            method: 'POST', headers, body
        })

        if (!resp.ok) {
            throw new Error(`Tencent Image OCR API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            Response?: {
                ImageRecord?: {
                    Value?: Array<{ SourceText: string; TargetText: string }>
                }
                Error?: { Message?: string; Code?: string }
            }
        }

        if (data.Response?.Error) {
            throw new Error(`Tencent Image OCR error: ${String(data.Response.Error.Message ?? data.Response.Error.Code)}`)
        }

        const items = data.Response?.ImageRecord?.Value
        if (!items) {
            throw new Error('Tencent Image OCR: no result in response')
        }

        if (language === 'auto') {
            return items.map((i) => i.SourceText).join('\n')
        }
        return items.map((i) => i.TargetText).join('\n')
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
