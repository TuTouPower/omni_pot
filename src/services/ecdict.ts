import type { TranslateService, ServiceConfig, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const ECDICT_LANGUAGES: LanguageCode[] = ['auto', 'zh_cn', 'zh_tw', 'en']

export const ecdictService: TranslateService = {
    key: 'ecdict',
    name: 'ECDict',
    languages: ECDICT_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        _to: LanguageCode,
        _config: ServiceConfig
    ): Promise<string | DictResult> {
        if (from === 'auto') {
            from = /^[A-Za-z]/.test(text) ? 'en' : 'zh_cn'
        }

        if (from !== 'en' && from !== 'zh_cn' && from !== 'zh_tw') {
            return ''
        }

        const resp = await fetch('https://pot-app.com/api/dict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        })

        if (!resp.ok) {
            throw new Error(`ECDict API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            pronunciations?: Array<{ region: string; symbol: string }>
            explanations?: Array<{ trait: string; explains: string[] }>
            sentence?: Array<{ source: string }>
        }

        const pronunciations: DictResult['pronunciations'] = (data.pronunciations ?? []).map(
            (p) => ({ region: p.region, phonetic: p.symbol })
        )

        const definitions: DictResult['definitions'] = (data.explanations ?? []).map(
            (e) => ({ partOfSpeech: e.trait, meanings: e.explains })
        )

        const examples: DictResult['examples'] = (data.sentence ?? []).map(
            (s) => ({ source: s.source, target: '' })
        )

        return {
            type: 'dict',
            pronunciations,
            definitions,
            examples
        }
    },

    async testConfig(_config: ServiceConfig): Promise<boolean> {
        try {
            const result = await this.translate('hello', 'en', 'zh_cn', {})
            return typeof result === 'object' && result.definitions.length > 0
        } catch {
            return false
        }
    }
}
