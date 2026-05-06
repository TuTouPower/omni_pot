import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const YANDEX_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru', 'de',
    'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi',
    'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he'
]

const YANDEX_LANG_MAP: Record<string, string> = {
    auto: '',
    zh_cn: 'zh',
    zh_tw: 'zh',
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
    nb_no: 'no',
    nn_no: 'no',
    fa: 'fa',
    sv: 'sv',
    pl: 'pl',
    nl: 'nl',
    uk: 'uk',
    he: 'he'
}

function map_lang(code: LanguageCode): string {
    return YANDEX_LANG_MAP[code] ?? code
}

function make_sid(): string {
    const hex = '0123456789abcdef'
    let uuid = ''
    for (let i = 0; i < 32; i++) {
        uuid += hex[Math.floor(Math.random() * 16)]
    }
    return uuid + '-0-0'
}

export const yandexService: TranslateService = {
    key: 'yandex',
    name: 'Yandex',
    languages: YANDEX_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        _config: ServiceConfig
    ): Promise<string> {
        const sid = make_sid()
        const from_lang = map_lang(from)
        const to_lang = map_lang(to)

        const params = new URLSearchParams({
            id: sid,
            srv: 'android',
            source_lang: from_lang,
            target_lang: to_lang,
            text
        })

        const resp = await fetch('https://translate.yandex.net/api/v1/tr.json/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        })

        if (!resp.ok) {
            throw new Error(`Yandex API error: ${resp.status}`)
        }

        const data = (await resp.json()) as { text?: string[] }
        if (!data.text || data.text.length === 0) {
            throw new Error('Yandex returned empty result')
        }
        return data.text[0]
    },

    async testConfig(_config: ServiceConfig): Promise<boolean> {
        try {
            const result = await this.translate('hello', 'en', 'zh_cn', {})
            return result.length > 0
        } catch {
            return false
        }
    }
}
