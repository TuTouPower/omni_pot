import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { iflytek_auth } from './iflytek_auth'

const SERVICE_ID = 'sf8e6aca1'

const IFLYTEK_OCR_LANGUAGES: LanguageCode[] = ['auto', 'zh_cn', 'zh_tw', 'en']

interface IflytekOcrTextJson {
    pages?: Array<{
        lines?: Array<{
            words?: Array<{ content?: string }>
        }>
    }>
}

export const iflytekOcrService: OcrService = {
    key: 'iflytek_ocr',
    name: 'iFlytek OCR',
    languages: IFLYTEK_OCR_LANGUAGES,

    async recognize(
        base64Image: string,
        _language: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const appid = config.appid as string
        const apisecret = config.apisecret as string
        const apikey = config.apikey as string

        const host = 'api.xf-yun.com'
        const date = new Date().toUTCString()
        const request_line = `POST /v1/private/${SERVICE_ID} HTTP/1.1`
        const auth = await iflytek_auth(apikey, apisecret, host, date, request_line)

        const url = `https://${host}/v1/private/${SERVICE_ID}?authorization=${auth}&host=${host}&date=${encodeURIComponent(date)}`

        const body = {
            header: { app_id: appid, status: 3 },
            parameter: {
                [SERVICE_ID]: {
                    category: 'ch_en_public_cloud',
                    result: { encoding: 'utf8', compress: 'raw', format: 'json' }
                }
            },
            payload: {
                [`${SERVICE_ID}_data_1`]: { image: base64Image }
            }
        }

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
        })

        if (!resp.ok) {
            throw new Error(`iFlytek OCR API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            payload?: { result?: { text?: string } }
            header?: { code?: number; message?: string }
        }

        if (data.header?.code && data.header.code !== 0) {
            throw new Error(`iFlytek OCR error: ${String(data.header.message ?? data.header.code)}`)
        }

        if (!data.payload?.result?.text) {
            throw new Error('iFlytek OCR: no result in response')
        }

        const text_json = JSON.parse(atob(data.payload.result.text)) as IflytekOcrTextJson
        let result = ''
        for (const page of text_json.pages ?? []) {
            for (const line of page.lines ?? []) {
                for (const word of line.words ?? []) {
                    if (word.content) result += word.content + ' '
                }
                result += '\n'
            }
        }

        return result.trim()
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
