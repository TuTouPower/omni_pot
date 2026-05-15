import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { signTencentRequest } from '../tencent_sign'

const TENCENT_OCR_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi'
]

export const tencentOcrService: OcrService = {
    key: 'tencent_ocr',
    name: 'Tencent OCR',
    languages: TENCENT_OCR_LANGUAGES,

    async recognize(
        base64Image: string,
        _language: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const secretId = config.secret_id as string
        const secretKey = config.secret_key as string

        const body = JSON.stringify({ ImageBase64: base64Image })

        const { headers } = await signTencentRequest({
            secretId, secretKey,
            host: 'ocr.tencentcloudapi.com',
            service: 'ocr', region: 'ap-beijing',
            action: 'GeneralBasicOCR', version: '2018-11-19', body
        })

        const resp = await fetch('https://ocr.tencentcloudapi.com', {
            method: 'POST', headers, body
        })

        if (!resp.ok) {
            throw new Error(`Tencent OCR API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            Response?: {
                TextDetections?: Array<{ DetectedText: string }>
                Error?: { Message?: string; Code?: string }
            }
        }

        if (data.Response?.Error) {
            throw new Error(`Tencent OCR error: ${String(data.Response.Error.Message ?? data.Response.Error.Code)}`)
        }

        return data.Response?.TextDetections?.map((d) => d.DetectedText).join('\n') ?? ''
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
