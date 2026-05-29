import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { iflytek_intsig_auth } from './iflytek_auth'
import { fetch_with_timeout } from '../fetch_timeout'

const IFLYTEK_INTSIG_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi'
]

export const iflytekIntsigOcrService: OcrService = {
    key: 'iflytek_intsig_ocr',
    name: 'iFlytek IntSig OCR',
    languages: IFLYTEK_INTSIG_LANGUAGES,

    async recognize(
        base64Image: string,
        _language: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const appid = config.appid as string
        const apisecret = config.apisecret as string
        const apikey = config.apikey as string

        const host = 'rest-api.xfyun.cn'
        const date = new Date().toUTCString()
        const request_line = 'POST /v2/itr HTTP/1.1'

        const body_json = JSON.stringify({
            common: { app_id: appid },
            business: { ent: 'teach-photo-print', aue: 'raw' },
            data: { image: base64Image }
        })

        const authorization = await iflytek_intsig_auth(apikey, apisecret, host, date, request_line, body_json)

        const resp = await fetch_with_timeout(`https://${host}/v2/itr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json,version=1.0',
                'Host': host,
                'Date': date,
                'Authorization': authorization
            },
            body: body_json
        })

        if (!resp.ok) {
            throw new Error(`iFlytek IntSig OCR API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            data?: { region?: Array<{ recog?: { content?: string } }> }
            message?: string
        }

        if (!data.data?.region) {
            throw new Error(`iFlytek IntSig OCR error: ${data.message ?? 'no region data'}`)
        }

        let result = ''
        for (const region of data.data.region) {
            if (region.recog?.content) {
                result += region.recog.content + '\n'
            }
        }

        return result
            .replaceAll(' ifly-latex-begin ', '')
            .replaceAll(' ifly-latex-end ', '')
            .trim()
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
