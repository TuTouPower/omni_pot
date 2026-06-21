import type { ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { md5 } from '@/lib/crypto'
import { fetch_with_timeout } from './fetch_timeout'

export const BAIDU_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he'
]

export const BAIDU_LANG_MAP: Record<string, string> = {
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

interface BaiduTranslateOptions {
    endpoint: string
    domain?: string
    error_label: string
}

export async function baidu_translate(
    text: string,
    from: LanguageCode,
    to: LanguageCode,
    config: ServiceConfig,
    options: BaiduTranslateOptions
): Promise<string> {
    const appid = config.appid as string
    const secret = config.secret as string
    const salt = crypto.randomUUID().replace(/-/g, '')
    const sign = md5(`${appid}${text}${salt}${secret}`)

    const from_lang = BAIDU_LANG_MAP[from] ?? from
    const to_lang = BAIDU_LANG_MAP[to] ?? to

    const params_obj: Record<string, string> = {
        q: text,
        from: from_lang,
        to: to_lang,
        appid,
        salt,
        sign
    }
    if (options.domain) {
        params_obj.domain = options.domain
    }

    const params = new URLSearchParams(params_obj)
    const url = `https://fanyi-api.baidu.com/api/trans/vip/${options.endpoint}?${params.toString()}`

    const resp = await fetch_with_timeout(url)
    if (!resp.ok) {
        throw new Error(`${options.error_label} API error: ${String(resp.status)}`)
    }

    const data = (await resp.json()) as {
        trans_result?: Array<{ dst: string }>
        error_code?: number | string
        error_msg?: string
    }

    if (data.error_code) {
        throw new Error(`${options.error_label} API error: ${data.error_msg ?? String(data.error_code)}`)
    }

    return data.trans_result?.map((r) => r.dst).join('\n') ?? ''
}

export async function baidu_test_config(
    service: { translate: (text: string, from: LanguageCode, to: LanguageCode, config: ServiceConfig) => Promise<string> },
    config: ServiceConfig
): Promise<boolean> {
    try {
        const result = await service.translate('hello', 'en', 'zh_cn', config)
        return typeof result === 'string' ? result.length > 0 : !!result
    } catch {
        return false
    }
}
