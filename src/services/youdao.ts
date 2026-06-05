import type { TranslateService, ServiceConfig, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { sha256 } from '@/lib/crypto'
import { fetch_with_timeout } from './fetch_timeout'

const YOUDAO_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'mn_mo', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'uk',
    'he'
]

const YOUDAO_LANG_MAP: Record<string, string> = {
    auto: 'auto',
    zh_cn: 'zh-CHS',
    zh_tw: 'zh-CHT',
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

function regex_capture(match: RegExpMatchArray, index: number): string {
    return match[index] ?? ''
}

async function buildSign(appKey: string, text: string, salt: string, curtime: string, key: string): Promise<string> {
    const input = text.length <= 20
        ? text
        : text.slice(0, 10) + String(text.length) + text.slice(-10)
    return sha256(`${appKey}${input}${salt}${curtime}${key}`)
}

export const youdaoService: TranslateService = {
    key: 'youdao',
    name: 'Youdao',
    languages: YOUDAO_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string | DictResult> {
        const appKey = config.appkey as string
        const key = config.key as string
        const salt = crypto.randomUUID().replace(/-/g, '')
        const curtime = String(Math.floor(Date.now() / 1000))
        const sign = await buildSign(appKey, text, salt, curtime, key)

        const fromLang = YOUDAO_LANG_MAP[from] ?? from
        const toLang = YOUDAO_LANG_MAP[to] ?? to

        const params = new URLSearchParams({
            q: text,
            from: fromLang,
            to: toLang,
            appKey,
            salt,
            curtime,
            signType: 'v3',
            sign
        })

        const resp = await fetch_with_timeout(`https://openapi.youdao.com/api?${params.toString()}`)
        if (!resp.ok) {
            throw new Error(`Youdao translate API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            translation?: string[]
            basic?: {
                phonetic?: string
                explains?: string[]
                'us-phonetic'?: string
                'uk-phonetic'?: string
            }
            errorCode?: string
        }

        if (data.errorCode && data.errorCode !== '0') {
            throw new Error(`Youdao API error: ${data.errorCode}`)
        }

        const translated = data.translation?.[0] ?? ''

        if (data.basic) {
            const pronunciations: DictResult['pronunciations'] = []
            if (data.basic['us-phonetic']) {
                pronunciations.push({ region: 'US', phonetic: data.basic['us-phonetic'] })
            }
            if (data.basic['uk-phonetic']) {
                pronunciations.push({ region: 'UK', phonetic: data.basic['uk-phonetic'] })
            }
            if (data.basic.phonetic && pronunciations.length === 0) {
                pronunciations.push({ region: '', phonetic: data.basic.phonetic })
            }

            const definitions: DictResult['definitions'] = (data.basic.explains ?? [])
                .map((exp) => {
                    const match = exp.match(/^([a-z]+\.)\s*(.*)/)
                    if (match) {
                        return { part_of_speech: regex_capture(match, 1), meanings: [regex_capture(match, 2)] }
                    }
                    return { part_of_speech: '', meanings: [exp] }
                })

            if (pronunciations.length > 0 || definitions.length > 0) {
                return {
                    type: 'dict',
                    pronunciations,
                    definitions,
                    examples: []
                }
            }
        }

        return translated
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        try {
            const result = await this.translate('hello', 'en', 'zh_cn', config)
            if (typeof result === 'string') return result.length > 0
            return true
        } catch {
            return false
        }
    }
}
