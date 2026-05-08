import type { TranslateService, ServiceConfig, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const FREE_DICT_LANGUAGES: LanguageCode[] = ['auto', 'en']

interface DictEntry {
    word: string
    phonetic?: string
    phonetics?: Array<{
        text?: string
        audio?: string
    }>
    meanings?: Array<{
        partOfSpeech: string
        definitions?: Array<{
            definition: string
            example?: string
        }>
    }>
}

export const freeDictionaryService: TranslateService = {
    key: 'free_dictionary',
    name: 'Free Dictionary',
    languages: FREE_DICT_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        _to: LanguageCode,
        _config: ServiceConfig
    ): Promise<string | DictResult> {
        const word = text.trim().split(' ')[0].toLowerCase()
        if (!word || !/^[a-z]+$/i.test(word)) return ''

        const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
        const resp = await fetch(url)
        if (!resp.ok) {
            throw new Error(`Free Dictionary API ${resp.status}`)
        }

        const entries = await resp.json() as DictEntry[]
        if (!Array.isArray(entries) || entries.length === 0) {
            throw new Error('Word not found')
        }

        const entry = entries[0]
        const pronunciations: DictResult['pronunciations'] = []
        const definitions: DictResult['definitions'] = []
        const examples: DictResult['examples'] = []

        if (entry.phonetic) {
            pronunciations.push({ region: 'US', phonetic: entry.phonetic })
        }
        if (entry.phonetics) {
            for (const p of entry.phonetics) {
                if (p.text && !pronunciations.some(pr => pr.phonetic === p.text)) {
                    const region = p.audio?.includes('-us') ? 'US' : p.audio?.includes('-uk') ? 'UK' : ''
                    pronunciations.push({ region, phonetic: p.text })
                }
            }
        }

        if (entry.meanings) {
            for (const meaning of entry.meanings) {
                const meanings: string[] = []
                if (meaning.definitions) {
                    for (const def of meaning.definitions) {
                        meanings.push(def.definition)
                        if (def.example) {
                            examples.push({ source: def.example, target: '' })
                        }
                    }
                }
                if (meanings.length > 0) {
                    definitions.push({
                        partOfSpeech: meaning.partOfSpeech,
                        meanings
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
            return typeof result === 'object' && result.definitions.length > 0
        } catch {
            return false
        }
    }
}
