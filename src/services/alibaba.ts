import { randomUUID } from 'node:crypto'
import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { hmac, hexToBase64 } from '@/lib/crypto'

const ALIBABA_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'yue', 'ja', 'en', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'mn_mo', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'he'
]

const ALIBABA_LANG_MAP: Record<string, string> = {
    auto: 'auto',
    zh_cn: 'zh',
    zh_tw: 'zh-tw',
    yue: 'yue',
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
    mn_mo: 'mn',
    km: 'km',
    nb_no: 'no',
    nn_no: 'no',
    fa: 'fa',
    sv: 'sv',
    pl: 'pl',
    nl: 'nl',
    he: 'he'
}

function percentEncode(str: string): string {
    return encodeURIComponent(str)
        .replace(/\+/g, '%20')
        .replace(/\*/g, '%2A')
        .replace(/~/g, '%7E')
}

async function buildSignature(params: Record<string, string>, accesskeySecret: string): Promise<string> {
    const sortedKeys = Object.keys(params).sort()
    const canonicalQuery = sortedKeys
        .map((k) => `${percentEncode(k)}=${percentEncode(params[k] ?? '')}`)
        .join('&')
    const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonicalQuery)}`
    const hex = await hmac(`${accesskeySecret}&`, stringToSign, 'SHA-1')
    return hexToBase64(hex)
}

export const alibabaService: TranslateService = {
    key: 'alibaba',
    name: 'Alibaba',
    languages: ALIBABA_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const accessKeyId = config.accesskey_id as string
        const accessKeySecret = config.accesskey_secret as string

        const sourceLang = ALIBABA_LANG_MAP[from] ?? from
        const targetLang = ALIBABA_LANG_MAP[to] ?? to

        const params: Record<string, string> = {
            Action: 'TranslateGeneral',
            FormatType: 'text',
            SourceLanguage: sourceLang,
            TargetLanguage: targetLang,
            SourceText: text,
            Format: 'JSON',
            AccessKeyId: accessKeyId,
            SignatureMethod: 'HMAC-SHA1',
            SignatureVersion: '1.0',
            SignatureNonce: randomUUID().replace(/-/g, ''),
            Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            Version: '2018-10-12'
        }

        params.Signature = await buildSignature(params, accessKeySecret)

        const url = new URL('https://mt.aliyuncs.com/')
        for (const [k, v] of Object.entries(params)) {
            url.searchParams.set(k, v)
        }

        const resp = await fetch(url.toString())
        if (!resp.ok) {
            throw new Error(`Alibaba translate API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            Data?: { Translated?: string }
            Code?: string
            Message?: string
        }

        if (data.Code && data.Code !== '200') {
            throw new Error(`Alibaba API error: ${data.Message ?? data.Code}`)
        }

        return data.Data?.Translated ?? ''
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        try {
            const result = await this.translate('hello', 'en', 'zh_cn', config)
            return typeof result === "string" ? result.length > 0 : !!result
        } catch {
            return false
        }
    }
}
