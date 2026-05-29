import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { fetch_with_timeout } from './fetch_timeout'

const OLLAMA_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'mn_mo', 'mn_cy', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl',
    'nl', 'uk', 'he'
]

import { buildTranslationPrompt } from './llm_prompt'

function build_system_prompt(config: ServiceConfig, from: LanguageCode, to: LanguageCode): string {
    return buildTranslationPrompt(config, from, to)
}

export const ollamaService: TranslateService = {
    key: 'ollama',
    name: 'Ollama',
    languages: OLLAMA_LANGUAGES,

    async *translateStream(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): AsyncGenerator<string, void, unknown> {
        const model = (config.model as string) || 'gemma:2b'
        const request_path = (config.requestPath as string) || 'http://localhost:11434'
        const base = request_path.replace(/\/+$/, '')
        const url = `${base}/api/chat`

        const system_prompt = build_system_prompt(config, from, to)

        const resp = await fetch_with_timeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: system_prompt },
                    { role: 'user', content: text }
                ],
                stream: true
            })
        })

        if (!resp.ok) throw new Error(`Ollama API error: ${String(resp.status)}`)

        const reader = resp.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (reader) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
                if (!line.trim()) continue
                try {
                    const json = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
                    if (json.message?.content) yield json.message.content
                    if (json.done) return
                } catch { /* skip malformed */ }
            }
        }
    },

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

        const resp = await fetch_with_timeout(url, {
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
            throw new Error(`Ollama API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            message?: { content?: string }
        }
        return data.message?.content ?? ''
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
