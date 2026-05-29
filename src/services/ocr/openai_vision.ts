import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'
import { fetch_with_timeout } from '../fetch_timeout'

const OPENAI_VISION_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'fa', 'pl', 'nl', 'uk'
]

export const openaiVisionOcrService: OcrService = {
    key: 'openai_compatible',
    name: 'OpenAI Vision',
    languages: OPENAI_VISION_LANGUAGES,

    async recognize(
        base64Image: string,
        _language: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const base_url = ((config.baseUrl as string) || 'https://api.openai.com/v1/chat/completions').replace(/\/+$/, '')
        const api_key = (config.apiKey as string) || ''
        const model = (config.model as string) || 'gpt-4o'

        const url = base_url.includes('/chat/completions')
            ? base_url
            : `${base_url}/chat/completions`

        const payload = {
            model,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Extract all text from this image. Only output the text, nothing else.'
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/png;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ]
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        }

        if (api_key) {
            headers['Authorization'] = `Bearer ${api_key}`
        }

        const resp = await fetch_with_timeout(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        }, 60_000)

        if (!resp.ok) {
            throw new Error(`OpenAI Vision API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string } }>
        }

        return data.choices?.[0]?.message?.content ?? ''
    },

    testConfig(config: ServiceConfig): Promise<boolean> {
        try {
            const api_key = (config.apiKey as string) || ''
            return Promise.resolve(api_key.length > 0)
        } catch {
            return Promise.resolve(false)
        }
    }
}
