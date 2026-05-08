import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const CHATGLM_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'mn_mo', 'mn_cy', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl',
    'nl', 'uk', 'he'
]

import { buildTranslationPrompt } from './llm_prompt'

function build_system_prompt(config: ServiceConfig, from: LanguageCode, to: LanguageCode): string {
    return buildTranslationPrompt(config, from, to)
}

export const chatglmService: TranslateService = {
    key: 'chatglm',
    name: 'ChatGLM',
    languages: CHATGLM_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const model = (config.model as string) || 'glm-4-flash'
        const api_key = (config.apiKey as string) || ''

        const system_prompt = build_system_prompt(config, from, to)

        const resp = await fetch(
            'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${api_key}`
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: system_prompt },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.1
                })
            }
        )

        if (!resp.ok) {
            throw new Error(`ChatGLM API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string } }>
        }
        return data.choices?.[0]?.message?.content ?? ''
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
