import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const MYMEMORY_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'ja', 'en', 'ko', 'fr', 'es', 'ru', 'de',
    'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi',
    'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he'
]

const MYMEMORY_LANG_MAP: Record<string, string> = {
    auto: 'autodetect',
    zh_cn: 'zh-CN',
    zh_tw: 'zh-TW',
    pt_pt: 'pt-PT',
    pt_br: 'pt-BR',
    nb_no: 'no',
    nn_no: 'no'
}

function mapLang(code: LanguageCode): string {
    return MYMEMORY_LANG_MAP[code] ?? code
}

export const mymemoryService: TranslateService = {
    key: 'mymemory',
    name: 'MyMemory',
    languages: MYMEMORY_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const baseUrl = (config.custom_url as string) || 'https://api.mymemory.translated.net'

        const url = new URL('/get', baseUrl)
        url.searchParams.set('q', text)
        url.searchParams.set('langpair', `${mapLang(from)}|${mapLang(to)}`)

        if (config.api_key) {
            url.searchParams.set('key', config.api_key as string)
        }

        const resp = await fetch(url.toString())
        if (!resp.ok) {
            throw new Error(`MyMemory API ${resp.status}`)
        }

        const data = await resp.json() as {
            responseData?: { translatedText?: string }
            responseStatus?: number
        }

        if (data.responseStatus === 403) {
            throw new Error('MyMemory daily limit reached')
        }

        const translated = data.responseData?.translatedText
        if (!translated) {
            throw new Error('MyMemory returned empty result')
        }

        return translated
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        try {
            const result = await this.translate('hello', 'en', 'zh_cn', config)
            return typeof result === 'string' && result.length > 0
        } catch {
            return false
        }
    }
}
