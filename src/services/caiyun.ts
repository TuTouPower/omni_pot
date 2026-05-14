import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const CAIYUN_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja'
]

const CAIYUN_LANG_MAP: Record<string, string> = {
    auto: 'auto',
    zh_cn: 'zh',
    zh_tw: 'zh',
    en: 'en',
    ja: 'ja'
}

export const caiyunService: TranslateService = {
    key: 'caiyun',
    name: 'Caiyun',
    languages: CAIYUN_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const token = config.token as string
        const fromLang = CAIYUN_LANG_MAP[from] ?? from
        const toLang = CAIYUN_LANG_MAP[to] ?? to

        const transType = from === 'auto'
            ? 'auto2zh'
            : `${fromLang}2${toLang}`

        const resp = await fetch('https://api.interpreter.caiyunai.com/v1/translator', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Authorization': `token ${token}`
            },
            body: JSON.stringify({
                source: [text],
                trans_type: transType
            })
        })

        if (!resp.ok) {
            throw new Error(`Caiyun translate API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            target?: string[]
        }

        return data.target?.[0] ?? ''
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
