import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { iflytek_auth } from './iflytek_auth'
import { fetch_with_timeout } from '../fetch_timeout'

const SERVICE_ID = 'hh_ocr_recognize_doc'

const IFLYTEK_LATEX_LANGUAGES: LanguageCode[] = ['auto', 'zh_cn', 'zh_tw', 'en']

interface IflytekLatexTextJson {
    whole_text?: string
}

export const iflytekLatexOcrService: OcrService = {
    key: 'iflytek_latex_ocr',
    name: 'iFlytek LaTeX OCR',
    languages: IFLYTEK_LATEX_LANGUAGES,

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

        const url = `https://${host}/v1/private/${SERVICE_ID}?authorization=${encodeURIComponent(auth)}&host=${host}&date=${encodeURIComponent(date)}`

        const body = {
            header: { app_id: appid, status: 3 },
            parameter: {
                [SERVICE_ID]: {
                    recognizeDocumentRes: {
                        encoding: 'utf8',
                        compress: 'raw',
                        format: 'json'
                    }
                }
            },
            payload: {
                image: { image: base64Image }
            }
        }

        const resp = await fetch_with_timeout(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
        })

        if (!resp.ok) {
            throw new Error(`iFlytek LaTeX OCR API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            payload?: { recognizeDocumentRes?: { text?: string } }
            header?: { code?: number; message?: string }
        }

        if (data.header?.code && data.header.code !== 0) {
            throw new Error(`iFlytek LaTeX OCR error: ${String(data.header.message ?? data.header.code)}`)
        }

        if (!data.payload?.recognizeDocumentRes?.text) {
            throw new Error('iFlytek LaTeX OCR: no result in response')
        }

        const text_json = JSON.parse(atob(data.payload.recognizeDocumentRes.text)) as IflytekLatexTextJson
        return (text_json.whole_text ?? '').trim()
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
