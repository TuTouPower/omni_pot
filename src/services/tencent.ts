import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { hmac, sha256 } from '@/lib/crypto'

const TENCENT_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru', 'de',
    'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi'
]

const TENCENT_LANG_MAP: Record<string, string> = {
    auto: 'auto',
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

export const tencentService: TranslateService = {
    key: 'tencent',
    name: 'Tencent',
    languages: TENCENT_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const secretId = config.secret_id as string
        const secretKey = config.secret_key as string

        const sourceLang = TENCENT_LANG_MAP[from] ?? from
        const targetLang = TENCENT_LANG_MAP[to] ?? to

        const host = 'tmt.tencentcloudapi.com'
        const service = 'tmt'
        const region = 'ap-beijing'
        const action = 'TextTranslate'

        const body = JSON.stringify({
            SourceText: text,
            Source: sourceLang,
            Target: targetLang,
            ProjectId: 0
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
                'X-TC-Version': '2018-03-21',
                'X-TC-Region': region,
                'Authorization': authorization
            },
            body
        })

        if (!resp.ok) {
            throw new Error(`Tencent translate API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            Response?: {
                TargetText?: string
                Error?: { Message?: string; Code?: string }
            }
        }

        if (data.Response?.Error) {
            throw new Error(`Tencent API error: ${data.Response.Error.Message ?? data.Response.Error.Code}`)
        }

        return data.Response?.TargetText ?? ''
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        try {
            const result = await this.translate('hello', 'en', 'zh_cn', config)
            return result.length > 0
        } catch {
            return false
        }
    }
}
