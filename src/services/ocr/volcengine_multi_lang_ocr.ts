import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { hmac, sha256 } from '@/lib/crypto'
import { fetch_with_timeout } from '../fetch_timeout'

const VOLCENGINE_MULTI_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi', 'fa'
]

function hexToBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return bytes.buffer
}

export const volcengineMultiLangOcrService: OcrService = {
    key: 'volcengine_multi_lang_ocr',
    name: 'Volcengine Multi-lang OCR',
    languages: VOLCENGINE_MULTI_LANGUAGES,

    async recognize(
        base64Image: string,
        _language: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const appid = config.appid as string
        const secret = config.secret as string

        const host = 'visual.volcengineapi.com'
        const service = 'cv'
        const region = 'cn-north-1'
        const action = 'MultiLanguageOCR'
        const version = '2022-08-31'

        const body = `image_base64=${encodeURIComponent(base64Image)}&approximate_pixel=0&mode=default&filter_thresh=80`
        const body_hash = await sha256(body)

        const now = new Date(Date.now() + 8 * 3600000)
        const x_date = now.toISOString().replace(/-/g, '').replace(/:/g, '').replace(/\.\d+/, '')
        const short_date = x_date.slice(0, 8)

        const signed_headers_map: Record<string, string> = {
            'content-type': 'application/x-www-form-urlencoded',
            host,
            'x-content-sha256': body_hash,
            'x-date': x_date
        }
        const sorted_keys = Object.keys(signed_headers_map).sort()
        let signed_str = ''
        let signed_header_keys = ''
        for (const k of sorted_keys) {
            signed_str += `${k}:${signed_headers_map[k] ?? ''}\n`
            signed_header_keys += `${k};`
        }
        signed_header_keys = signed_header_keys.slice(0, -1)

        const norm_query = `Action=${action}&Version=${version}`
        const canonical_request = `POST\n/\n${norm_query}\n${signed_str}\n${signed_header_keys}\n${body_hash}`

        const credential_scope = `${short_date}/${region}/${service}/request`
        const string_to_sign = `HMAC-SHA256\n${x_date}\n${credential_scope}\n${await sha256(canonical_request)}`

        const kDate = await hmac(secret, short_date, 'SHA-256')
        const kRegion = await hmac(hexToBuffer(kDate), region, 'SHA-256')
        const kService = await hmac(hexToBuffer(kRegion), service, 'SHA-256')
        const kSigning = await hmac(hexToBuffer(kService), 'request', 'SHA-256')
        const signature = await hmac(hexToBuffer(kSigning), string_to_sign, 'SHA-256')

        const authorization = `HMAC-SHA256 Credential=${appid}/${credential_scope}, SignedHeaders=${signed_header_keys}, Signature=${signature}`

        const resp = await fetch_with_timeout(`https://${host}/?${norm_query}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Host': host,
                'X-Date': x_date,
                'X-Content-Sha256': body_hash,
                'Authorization': authorization
            },
            body
        })

        if (!resp.ok) {
            throw new Error(`Volcengine Multi-lang OCR API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            data?: { ocr_infos?: Array<{ text: string }> }
            ResponseMetadata?: { Error?: { Message?: string; Code?: string } }
        }

        if (data.ResponseMetadata?.Error) {
            throw new Error(`Volcengine Multi-lang OCR error: ${String(data.ResponseMetadata.Error.Message ?? data.ResponseMetadata.Error.Code)}`)
        }

        return data.data?.ocr_infos?.map((t) => t.text).join('\n') ?? ''
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
