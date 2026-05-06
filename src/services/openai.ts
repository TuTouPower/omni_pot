import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const OPENAI_LANGUAGES: LanguageCode[] = [
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

function build_url(config: ServiceConfig): string {
    const service = (config.service as string) || 'openai'
    const request_path = (config.requestPath as string) || 'https://api.openai.com/v1/chat/completions'

    if (service === 'azure') {
        const api_key = config.apiKey as string
        const model = (config.model as string) || 'gpt-3.5-turbo'
        const base = request_path.replace(/\/+$/, '')
        return `${base}/openai/deployments/${model}/chat/completions?api-version=2024-02-15-preview`
    }

    return request_path
}

function build_headers(config: ServiceConfig): Record<string, string> {
    const service = (config.service as string) || 'openai'
    const api_key = (config.apiKey as string) || ''

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    }

    if (service === 'azure') {
        headers['api-key'] = api_key
    } else {
        headers['Authorization'] = `Bearer ${api_key}`
    }

    return headers
}

async function translate_stream(resp: Response): Promise<string> {
    const reader = resp.body?.getReader()
    const decoder = new TextDecoder()
    let result = ''

    while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
            const trimmed = line.trim()
            if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                const json = JSON.parse(trimmed.slice(6))
                const content = json.choices?.[0]?.delta?.content
                if (content) result += content
            }
        }
    }

    return result
}

export const openaiService: TranslateService = {
    key: 'openai',
    name: 'OpenAI',
    languages: OPENAI_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const model = (config.model as string) || 'gpt-3.5-turbo'
        const stream = config.stream as boolean
        const request_arguments_raw = (config.requestArguments as string) || '{"temperature":0.1}'
        let request_arguments: Record<string, unknown> = { temperature: 0.1 }
        try {
            request_arguments = JSON.parse(request_arguments_raw)
        } catch {
            request_arguments = { temperature: 0.1 }
        }

        const system_prompt = build_system_prompt(config, from, to)
        const url = build_url(config)
        const headers = build_headers(config)

        const messages = [
            { role: 'system', content: system_prompt },
            { role: 'user', content: text }
        ]

        const payload: Record<string, unknown> = {
            ...request_arguments,
            model,
            messages,
            stream: !!stream
        }

        const resp = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        })

        if (!resp.ok) {
            throw new Error(`OpenAI API error: ${resp.status}`)
        }

        if (stream) {
            return translate_stream(resp)
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
