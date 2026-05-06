import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const TRANSMART_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru', 'de',
    'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'km'
]

const TRANSMART_LANG_MAP: Record<string, string> = {
    auto: 'auto',
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
    km: 'km'
}

export const transmartService: TranslateService = {
    key: 'transmart',
    name: 'TranSmart',
    languages: TRANSMART_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const username = config.username as string
        const token = config.token as string

        const sourceLang = TRANSMART_LANG_MAP[from] ?? from
        const targetLang = TRANSMART_LANG_MAP[to] ?? to

        const params = new URLSearchParams({
            source: sourceLang,
            target: targetLang,
            text: text,
            revision: '1'
        })

        const resp = await fetch('https://transmart.qq.com/api/imt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${username}:${token}`
            },
            body: params.toString()
        })

        if (!resp.ok) {
            throw new Error(`TranSmart translate API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            autoTranslation?: string
            translation?: string
            ResponseMetadata?: { Error?: { Message?: string; Code?: string } }
        }

        if (data.ResponseMetadata?.Error) {
            throw new Error(`TranSmart API error: ${data.ResponseMetadata.Error.Message ?? data.ResponseMetadata.Error.Code}`)
        }

        return data.autoTranslation ?? data.translation ?? ''
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
