import type { TranslateService, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const CHINESE_DICTIONARY_LANGUAGES: LanguageCode[] = ['auto', 'zh_cn']

export const chineseDictionaryService: TranslateService = {
    key: 'chinese_dictionary',
    name: '中文词典',
    languages: CHINESE_DICTIONARY_LANGUAGES,

    async translate(text: string): Promise<string | DictResult> {
        const word = text.trim().replace(/\s+/g, '')
        if (!word) return ''

        try {
            const result = await window.electronAPI.chineseDict.lookup(word)
            return result ?? ''
        } catch {
            return ''
        }
    },

    async testConfig(): Promise<boolean> {
        try {
            const check = await window.electronAPI.chineseDict.check()
            return check.ready
        } catch {
            return false
        }
    }
}
