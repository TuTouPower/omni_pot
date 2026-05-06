import type { TtsService } from '@shared/types/tts_service'
import type { LanguageCode } from '@shared/types/language'

const LINGVA_TTS_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'ja', 'en', 'ko', 'fr', 'es', 'ru', 'de',
    'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi',
    'mn_cy', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he'
]

const LINGVA_TTS_LANG_MAP: Record<string, string> = {
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
    return LINGVA_TTS_LANG_MAP[code] ?? code
}

export const lingvaTtsService: TtsService = {
    key: 'lingva_tts',
    name: 'Lingva TTS',
    languages: LINGVA_TTS_LANGUAGES,

    async synthesize(
        text: string,
        language: LanguageCode,
        config: Record<string, unknown>
    ): Promise<ArrayBuffer> {
        let request_path = (config.requestPath as string) || 'https://lingva.pot-app.com'
        if (request_path.endsWith('/')) {
            request_path = request_path.slice(0, -1)
        }

        const lang = map_lang(language)
        const encoded_text = encodeURIComponent(text)
        const url = `${request_path}/api/v2/audio/${lang}/${encoded_text}`

        const resp = await fetch(url)
        if (!resp.ok) {
            throw new Error(`Lingva TTS API error: ${resp.status}`)
        }

        return resp.arrayBuffer()
    },

    async testConfig(config: Record<string, unknown>): Promise<boolean> {
        try {
            const result = await this.synthesize('hello', 'en', config)
            return result.byteLength > 0
        } catch {
            return false
        }
    }
}
