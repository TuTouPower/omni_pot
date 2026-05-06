import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const OLLAMA_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'mn_mo', 'mn_cy', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl',
    'nl', 'uk', 'he'
]

function build_system_prompt(config: ServiceConfig, from: LanguageCode, to: LanguageCode): string {
    const custom = config.promptList as string | undefined
    if (custom) return custom
    const source_lang = from === 'auto' ? 'auto-detect' : from
    const target_lang = to
    return `You are a professional translation engine. Translate the following text from ${source_lang} to ${target_lang}. Only output the translation result, nothing else.`
}

export const ollamaService: TranslateService = {
    key: 'ollama',
    name: 'Ollama',
    languages: OLLAMA_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const model = (config.model as string) || 'gemma:2b'
        const request_path = (config.requestPath as string) || 'http://localhost:11434'

        const system_prompt = build_system_prompt(config, from, to)

        const base = request_path.replace(/\/+$/, '')
        const url = `${base}/api/chat`

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: system_prompt },
                    { role: 'user', content: text }
                ],
                stream: false
            })
        })

        if (!resp.ok) {
            throw new Error(`Ollama API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            message?: { content?: string }
        }
        return data.message?.content ?? ''
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
