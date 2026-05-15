import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'

const SIMPLE_LATEX_LANGUAGES: LanguageCode[] = ['auto', 'zh_cn', 'zh_tw', 'en']

export const simpleLatexOcrService: OcrService = {
    key: 'simple_latex_ocr',
    name: 'Simple LaTeX OCR',
    languages: SIMPLE_LATEX_LANGUAGES,

    async recognize(
        base64Image: string,
        _language: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const token = config.token as string

        const binary = Uint8Array.from(atob(base64Image), (c) => c.charCodeAt(0))
        const blob = new Blob([binary], { type: 'image/png' })
        const form = new FormData()
        form.append('file', blob, 'image.png')

        const resp = await fetch('https://server.simpletex.cn/api/latex_ocr/v2', {
            method: 'POST',
            headers: { token },
            body: form
        })

        if (!resp.ok) {
            throw new Error(`Simple LaTeX OCR API error: ${String(resp.status)}`)
        }

        const data = (await resp.json()) as {
            res?: { latex?: string }
            status?: boolean
            message?: string
        }

        if (!data.res?.latex) {
            throw new Error(`Simple LaTeX OCR error: ${data.message ?? 'no result'}`)
        }

        let latex = data.res.latex.trim()
        latex = latex.replace(/\\text\{([^}]*)\}/g, '$1')
        latex = latex.replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})?/g, '')
        latex = latex.replace(/[{}]/g, '')
        latex = latex.replace(/\s+/g, ' ').trim()
        return latex
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        try {
            await this.recognize(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                'en',
                config
            )
            return true
        } catch {
            return false
        }
    }
}
