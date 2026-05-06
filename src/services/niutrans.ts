import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const NIUTRANS_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'mn_cy', 'mn_mo', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl',
    'nl', 'uk', 'he'
]

const NIUTRANS_LANG_MAP: Record<string, string> = {
    auto: 'auto',
    zh_cn: 'zh',
    zh_tw: 'cht',
    yue: 'yue',
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
    hi: 'hi',
    mn_cy: 'mn',
    mn_mo: 'mn',
    km: 'km',
    nb_no: 'no',
    nn_no: 'no',
    fa: 'fa',
    sv: 'sv',
    pl: 'pl',
    nl: 'nl',
    uk: 'uk',
    he: 'he'
}

export const niutransService: TranslateService = {
    key: 'niutrans',
    name: 'NiuTrans',
    languages: NIUTRANS_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const apikey = config.apikey as string
        const useHttps = config.https !== false
        const protocol = useHttps ? 'https' : 'http'

        const fromLang = NIUTRANS_LANG_MAP[from] ?? from
        const toLang = NIUTRANS_LANG_MAP[to] ?? to

        const params = new URLSearchParams({
            from: fromLang,
            to: toLang,
            src_text: text,
            apikey
        })

        const resp = await fetch(
            `${protocol}://api.niutrans.com/NiuTransServer/translation?${params.toString()}`
        )
        if (!resp.ok) {
            throw new Error(`NiuTrans translate API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            tgt_text?: string
            error_code?: number | string
            error_msg?: string
        }

        if (data.error_code) {
            throw new Error(`NiuTrans API error: ${data.error_msg ?? data.error_code}`)
        }

        return data.tgt_text ?? ''
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
