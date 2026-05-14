import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { signTencentRequest } from './tencent_sign'

const TENCENT_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru', 'de',
    'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi'
]

const TENCENT_LANG_MAP: Record<string, string> = {
    auto: 'auto',
    zh_cn: 'zh',
    zh_tw: 'zh-TW',
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
    hi: 'hi'
}

export const tencentService: TranslateService = {
    key: 'tencent',
    name: 'Tencent',
    languages: TENCENT_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const secretId = config.secret_id as string
        const secretKey = config.secret_key as string

        const sourceLang = TENCENT_LANG_MAP[from] ?? from
        const targetLang = TENCENT_LANG_MAP[to] ?? to

        const body = JSON.stringify({
            SourceText: text,
            Source: sourceLang,
            Target: targetLang,
            ProjectId: 0
        })

        const { headers } = await signTencentRequest({
            secretId, secretKey,
            host: 'tmt.tencentcloudapi.com',
            service: 'tmt', region: 'ap-beijing',
            action: 'TextTranslate', version: '2018-03-21', body
        })

        const resp = await fetch('https://tmt.tencentcloudapi.com', {
            method: 'POST', headers, body
        })

        if (!resp.ok) {
            throw new Error(`Tencent translate API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            Response?: {
                TargetText?: string
                Error?: { Message?: string; Code?: string }
            }
        }

        if (data.Response?.Error) {
            throw new Error(`Tencent API error: ${data.Response.Error.Message ?? data.Response.Error.Code}`)
        }

        return data.Response?.TargetText ?? ''
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
