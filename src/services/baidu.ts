import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { md5 } from '@/lib/crypto'

const BAIDU_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he'
]

const BAIDU_LANG_MAP: Record<string, string> = {
    auto: 'auto',
    zh_cn: 'zh',
    zh_tw: 'cht',
    yue: 'yue',
    en: 'en',
    ja: 'jp',
    ko: 'kor',
    fr: 'fra',
    es: 'spa',
    ru: 'ru',
    de: 'de',
    it: 'it',
    tr: 'tr',
    pt_pt: 'pt',
    pt_br: 'pt',
    vi: 'vie',
    id: 'id',
    th: 'th',
    ms: 'may',
    ar: 'ara',
    hi: 'hi',
    km: 'hkm',
    nb_no: 'nob',
    nn_no: 'nno',
    fa: 'per',
    sv: 'swe',
    pl: 'pl',
    nl: 'nl',
    uk: 'ukr',
    he: 'heb'
}

export const baiduService: TranslateService = {
    key: 'baidu',
    name: 'Baidu',
    languages: BAIDU_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const appid = config.appid as string
        const secret = config.secret as string
        const salt = Math.random().toString(36).substring(2)
        const sign = md5(`${appid}${text}${salt}${secret}`)

        const fromLang = BAIDU_LANG_MAP[from] ?? from
        const toLang = BAIDU_LANG_MAP[to] ?? to

        const params = new URLSearchParams({
            q: text,
            from: fromLang,
            to: toLang,
            appid,
            salt,
            sign
        })

        const resp = await fetch(
            `https://fanyi-api.baidu.com/api/trans/vip/translate?${params.toString()}`
        )
        if (!resp.ok) {
            throw new Error(`Baidu translate API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            trans_result?: Array<{ dst: string }>
            error_code?: number | string
            error_msg?: string
        }

        if (data.error_code) {
            throw new Error(`Baidu API error: ${data.error_msg ?? String(data.error_code)}`)
        }

        return data.trans_result?.map((r) => r.dst).join('\n') ?? ''
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
