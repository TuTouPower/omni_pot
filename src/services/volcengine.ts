import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { hmac, sha256 } from '@/lib/crypto'

const VOLCENGINE_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'ja', 'en', 'ko', 'fr', 'es', 'ru', 'de',
    'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi',
    'mn_cy', 'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he'
]

const VOLCENGINE_LANG_MAP: Record<string, string> = {
    auto: 'auto',
    zh_cn: 'zh',
    zh_tw: 'zh-Hant',
    ja: 'ja',
    en: 'en',
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
    hi: 'hi',
    mn_cy: 'mn',
    nb_no: 'no',
    nn_no: 'no',
    fa: 'fa',
    sv: 'sv',
    pl: 'pl',
    nl: 'nl',
    uk: 'uk',
    he: 'he'
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

export const volcengineService: TranslateService = {
    key: 'volcengine',
    name: 'Volcengine',
    languages: VOLCENGINE_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const appid = config.appid as string
        const secret = config.secret as string

        const sourceLang = VOLCENGINE_LANG_MAP[from] ?? from
        const targetLang = VOLCENGINE_LANG_MAP[to] ?? to

        const timestamp = Math.floor(Date.now() / 1000)
        const date = getDate(timestamp)

        const body = JSON.stringify({
            SourceLanguage: sourceLang,
            TargetLanguage: targetLang,
            Text: text
        })

        const host = 'open.volcengineapi.com'
        const service = 'translate'
        const region = 'cn-north-1'
        const action = 'TranslateText'

        const hashedPayload = await sha256(body)
        const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-content-sha256:${hashedPayload}\nx-date:${date}\n`
        const signedHeaders = 'content-type;host;x-content-sha256;x-date'
        const canonicalRequest = `POST\n/\nAction=${action}&Version=2020-06-01\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`

        const credentialScope = `${date}/${region}/${service}/request`
        const stringToSign = `HMAC-SHA256\n${date}\n${credentialScope}\n${await sha256(canonicalRequest)}`

        const kDate = await hmac(secret, date, 'SHA-256')
        const kRegion = await hmac(hexToBuffer(kDate), region, 'SHA-256')
        const kService = await hmac(hexToBuffer(kRegion), service, 'SHA-256')
        const kSigning = await hmac(hexToBuffer(kService), 'request', 'SHA-256')
        const signature = await hmac(hexToBuffer(kSigning), stringToSign, 'SHA-256')

        const authorization = `HMAC-SHA256 Credential=${appid}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

        const resp = await fetch(`https://${host}/?Action=${action}&Version=2020-06-01`, {
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
            throw new Error(`Volcengine translate API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            TranslationList?: Array<{ Translation: string }>
            ResponseMetadata?: { Error?: { Message?: string; Code?: string } }
        }

        if (data.ResponseMetadata?.Error) {
            throw new Error(`Volcengine API error: ${data.ResponseMetadata.Error.Message ?? data.ResponseMetadata.Error.Code}`)
        }

        return data.TranslationList?.[0]?.Translation ?? ''
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
