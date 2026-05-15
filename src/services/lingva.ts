import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const LINGVA_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'ja', 'en', 'ko', 'fr', 'es', 'ru', 'de',
    'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi',
    'mn_cy', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he'
]

const LINGVA_LANG_MAP: Record<string, string> = {
    auto: 'auto',
    zh_cn: 'zh',
    zh_tw: 'zh_HANT',
    pt_pt: 'pt',
    pt_br: 'pt',
    nb_no: 'no',
    nn_no: 'no',
    mn_cy: 'mn',
    km: 'km'
}

function map_lang(code: LanguageCode): string {
    return LINGVA_LANG_MAP[code] ?? code
}

export const lingvaService: TranslateService = {
    key: 'lingva',
    name: 'Lingva',
    languages: LINGVA_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const configured_request_path = config.requestPath
        let request_path = typeof configured_request_path === 'string' && configured_request_path
            ? configured_request_path
            : 'https://lingva.lunar.icu'
        if (request_path.endsWith('/')) {
            request_path = request_path.slice(0, -1)
        }

        const encoded_text = encodeURIComponent(text)
        const url = `${request_path}/api/v1/${map_lang(from)}/${map_lang(to)}/${encoded_text}`

        const resp = await fetch(url)
        if (!resp.ok) {
            throw new Error(`Lingva API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as { translation?: string; error?: string }
        if (data.error) {
            throw new Error(`Lingva error: ${data.error}`)
        }
        if (!data.translation) {
            throw new Error('Lingva returned empty translation')
        }
        return data.translation
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
