import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { signVolcengineRequest } from '../volcengine_sign'

const VOLCENGINE_OCR_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi'
]

export const volcengineOcrService: OcrService = {
    key: 'volcengine_ocr',
    name: 'Volcengine OCR',
    languages: VOLCENGINE_OCR_LANGUAGES,

    async recognize(
        base64Image: string,
        _language: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const appid = config.appid as string
        const secret = config.secret as string

        const body = JSON.stringify({ image_base64: base64Image })

        const { headers, url } = await signVolcengineRequest({
            appId: appid, secret,
            host: 'open.volcengineapi.com',
            service: 'visual', region: 'cn-north-1',
            action: 'OCRTarget', version: '2022-08-31', body
        })

        const resp = await fetch(url, {
            method: 'POST', headers, body
        })

        if (!resp.ok) {
            throw new Error(`Volcengine OCR API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            data?: string
            resp?: {
                text_list?: Array<{ text: string }>
            }
            ResponseMetadata?: { Error?: { Message?: string; Code?: string } }
        }

        if (data.ResponseMetadata?.Error) {
            throw new Error(`Volcengine OCR error: ${String(data.ResponseMetadata.Error.Message ?? data.ResponseMetadata.Error.Code)}`)
        }

        if (data.resp?.text_list) {
            return data.resp.text_list.map((t) => t.text).join('\n')
        }

        return data.data ?? ''
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        try {
            await this.recognize(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                'en',
                config
            )
            return true
        } catch {
            return false
        }
    }
}
