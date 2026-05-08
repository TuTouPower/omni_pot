import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { signVolcengineRequest } from './volcengine_sign'

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

        const body = JSON.stringify({
            SourceLanguage: sourceLang,
            TargetLanguage: targetLang,
            Text: text
        })

        const { headers, url } = await signVolcengineRequest({
            appId: appid, secret,
            host: 'open.volcengineapi.com',
            service: 'translate', region: 'cn-north-1',
            action: 'TranslateText', version: '2020-06-01', body
        })

        const resp = await fetch(url, {
            method: 'POST', headers, body
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
