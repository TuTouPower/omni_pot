import type { TranslateService, ServiceConfig, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const BING_DICT_LANGUAGES: LanguageCode[] = ['auto', 'en', 'zh_cn', 'zh_tw']

export const bingDictService: TranslateService = {
    key: 'bing_dict',
    name: 'Bing Dict',
    languages: BING_DICT_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        _to: LanguageCode,
        _config: ServiceConfig
    ): Promise<string | DictResult> {
        if (from === 'auto') {
            from = /^[一-鿿]/.test(text) ? 'zh_cn' : 'en'
        }

        if (from !== 'en' && from !== 'zh_cn' && from !== 'zh_tw') {
            return ''
        }

        const resp = await fetch(
            `https://www.bing.com/api/v6/dictionarywords/search?q=${encodeURIComponent(text)}&appid=371E7B2AF0F9B84EC491D731DF90A55719C7D209&mkt=zh-cn&pname=bingdict`
        )

        if (!resp.ok) {
            throw new Error(`Bing Dict API error: ${resp.status}`)
        }

        const data = (await resp.json()) as {
            value: Array<{
                meaningGroups: Array<{
                    partsOfSpeech: Array<{ description: string; name: string }>
                    meanings: Array<{
                        richDefinitions: Array<{
                            fragments: Array<{ text: string }>
                        }>
                    }>
                }>
            }>
        }

        const meaning_groups = data.value?.[0]?.meaningGroups
        if (!meaning_groups || meaning_groups.length === 0) {
            throw new Error(`Word not found: ${text}`)
        }

        const pronunciations: DictResult['pronunciations'] = []
        const definitions: DictResult['definitions'] = []
        const examples: DictResult['examples'] = []

        for (const group of meaning_groups) {
            const pos_name = group.partsOfSpeech?.[0]?.name ?? ''
            const pos_desc = group.partsOfSpeech?.[0]?.description ?? ''

            if (pos_desc === '发音') {
                const fragment = group.meanings?.[0]?.richDefinitions?.[0]?.fragments?.[0]
                if (fragment) {
                    pronunciations.push({
                        region: pos_name,
                        phonetic: fragment.text
                    })
                }
            } else if (pos_desc === '快速释义') {
                const fragments = group.meanings?.[0]?.richDefinitions?.[0]?.fragments
                if (fragments) {
                    definitions.push({
                        partOfSpeech: pos_name,
                        meanings: fragments.map((f) => f.text)
                    })
                }
            }
        }

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
            return typeof result === 'object' && result.pronunciations.length > 0
        } catch {
            return false
        }
    }
}
