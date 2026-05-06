import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { hmac, sha256 } from '@/lib/crypto'

const TENCENT_OCR_LANGUAGES: LanguageCode[] = [
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

        const host = 'ocr.tencentcloudapi.com'
        const service = 'ocr'
        const region = 'ap-beijing'
        const action = 'GeneralBasicOCR'

        const body = JSON.stringify({
            ImageBase64: base64Image
        })

        const timestamp = Math.floor(Date.now() / 1000)
        const date = getDate(timestamp)

        const contentType = 'application/json; charset=utf-8'
        const hashedPayload = await sha256(body)

        const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
        const signedHeaders = 'content-type;host;x-tc-action'
        const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`

        const credentialScope = `${date}/${service}/tc3_request`
        const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${await sha256(canonicalRequest)}`

        const kDate = await hmac(`TC3${secretKey}`, date, 'SHA-256')
        const kService = await hmac(hexToBuffer(kDate), service, 'SHA-256')
        const kSigning = await hmac(hexToBuffer(kService), 'tc3_request', 'SHA-256')
        const signature = await hmac(hexToBuffer(kSigning), stringToSign, 'SHA-256')

        const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

        const resp = await fetch(`https://${host}`, {
            method: 'POST',
            headers: {
                'Content-Type': contentType,
                'Host': host,
                'X-TC-Action': action,
                'X-TC-Timestamp': String(timestamp),
                'X-TC-Version': '2018-11-19',
                'X-TC-Region': region,
                'Authorization': authorization
            },
            body
        })

        if (!resp.ok) {
            throw new Error(`Tencent OCR API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            Response?: {
                TextDetections?: Array<{ DetectedText: string }>
                Error?: { Message?: string; Code?: string }
            }
        }

        if (data.Response?.Error) {
            throw new Error(`Tencent OCR error: ${data.Response.Error.Message ?? data.Response.Error.Code}`)
        }

        return data.Response?.TextDetections?.map((d) => d.DetectedText).join('\n') ?? ''
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
