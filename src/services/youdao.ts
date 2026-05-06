import type { TranslateService, ServiceConfig, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { md5 } from '@/lib/crypto'

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

function buildSign(appKey: string, text: string, salt: string, key: string): string {
    const input = text.length <= 20
        ? text
        : text.slice(0, 10) + String(text.length) + text.slice(-10)
    return md5(`${appKey}${input}${salt}${key}`)
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
        const salt = Math.random().toString(36).substring(2)
        const sign = buildSign(appKey, text, salt, key)

        const fromLang = YOUDAO_LANG_MAP[from] ?? from
        const toLang = YOUDAO_LANG_MAP[to] ?? to

        const params = new URLSearchParams({
            q: text,
            from: fromLang,
            to: toLang,
            appKey,
            salt,
            sign
        })

        const resp = await fetch(`https://openapi.youdao.com/api?${params.toString()}`)
        if (!resp.ok) {
            throw new Error(`Youdao translate API error: ${resp.status}`)
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
                        return { partOfSpeech: match[1], meanings: [match[2]] }
                    }
                    return { partOfSpeech: '', meanings: [exp] }
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
