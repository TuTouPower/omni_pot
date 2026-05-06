import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { hmac, sha256 } from '@/lib/crypto'

const VOLCENGINE_OCR_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi'
]

function hexToBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return bytes.buffer
}

function getDate(timestamp: number): string {
    const d = new Date(timestamp * 1000)
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

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

        const host = 'open.volcengineapi.com'
        const service = 'visual'
        const region = 'cn-north-1'
        const action = 'OCRTarget'

        const body = JSON.stringify({
            image_base64: base64Image
        })

        const timestamp = Math.floor(Date.now() / 1000)
        const date = getDate(timestamp)

        const hashedPayload = await sha256(body)
        const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-content-sha256:${hashedPayload}\nx-date:${date}\n`
        const signedHeaders = 'content-type;host;x-content-sha256;x-date'
        const canonicalRequest = `POST\n/\nAction=${action}&Version=2022-08-31\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`

        const credentialScope = `${date}/${region}/${service}/request`
        const stringToSign = `HMAC-SHA256\n${date}\n${credentialScope}\n${await sha256(canonicalRequest)}`

        const kDate = await hmac(secret, date, 'SHA-256')
        const kRegion = await hmac(hexToBuffer(kDate), region, 'SHA-256')
        const kService = await hmac(hexToBuffer(kRegion), service, 'SHA-256')
        const kSigning = await hmac(hexToBuffer(kService), 'request', 'SHA-256')
        const signature = await hmac(hexToBuffer(kSigning), stringToSign, 'SHA-256')

        const authorization = `HMAC-SHA256 Credential=${appid}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

        const resp = await fetch(`https://${host}/?Action=${action}&Version=2022-08-31`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Host': host,
                'X-Date': date,
                'X-Content-Sha256': hashedPayload,
                'Authorization': authorization
            },
            body
        })

        if (!resp.ok) {
            throw new Error(`Volcengine OCR API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            data?: string
            resp?: {
                text_list?: Array<{ text: string }>
            }
            ResponseMetadata?: { Error?: { Message?: string; Code?: string } }
        }

        if (data.ResponseMetadata?.Error) {
            throw new Error(`Volcengine OCR error: ${data.ResponseMetadata.Error.Message ?? data.ResponseMetadata.Error.Code}`)
        }

        if (data.resp?.text_list) {
            return data.resp.text_list.map((t) => t.text).join('\n')
        }

        return data.data ?? ''
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        try {
            const result = await this.recognize(
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
