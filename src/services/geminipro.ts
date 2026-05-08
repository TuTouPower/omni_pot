import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const GEMINI_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'mn_mo', 'mn_cy', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl',
    'nl', 'uk', 'he'
]

import { buildTranslationPrompt } from './llm_prompt'

function build_prompt(config: ServiceConfig, from: LanguageCode, to: LanguageCode): string {
    return buildTranslationPrompt(config, from, to)
}

export const geminiproService: TranslateService = {
    key: 'geminipro',
    name: 'Gemini Pro',
    languages: GEMINI_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const api_key = (config.apiKey as string) || ''
        const request_path = (config.requestPath as string) || 'https://generativelanguage.googleapis.com/v1beta'
        const model = (config.model as string) || 'gemini-2.0-flash'

        const prompt = build_prompt(config, from, to)
        const full_prompt = `${prompt}\n\n${text}`

        const base = request_path.replace(/\/+$/, '')
        const url = `${base}/models/${model}:generateContent?key=${api_key}`

        const body: Record<string, unknown> = {
            contents: [{ parts: [{ text: full_prompt }] }],
            generationConfig: { temperature: 0.1 }
        }

        const thinking_budget = config.thinkingBudget as number | undefined
        if (thinking_budget !== undefined) {
            const gen_config = body.generationConfig as Record<string, unknown>
            gen_config.thinkingBudget = thinking_budget
        }

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })

        if (!resp.ok) {
            throw new Error(`Gemini API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            candidates?: Array<{
                content?: {
                    parts?: Array<{ text?: string }>
                }
            }>
        }
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
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
