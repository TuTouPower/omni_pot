import type { TranslateService, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { create_logger } from '../utils/logger'

const log = create_logger('chinese_dictionary')
const CHINESE_DICTIONARY_LANGUAGES: LanguageCode[] = ['auto', 'zh_cn']

export const chineseDictionaryService: TranslateService = {
    key: 'chinese_dictionary',
    name: 'Chinese Dictionary',
    languages: CHINESE_DICTIONARY_LANGUAGES,

    async translate(text: string): Promise<string | DictResult> {
        const word = text.trim().replace(/\s+/g, '')
        if (!word) return ''

        try {
            const result = await window.electronAPI.chinese_dict.lookup(word)
            return result ?? ''
        } catch (err) {
            log.error('lookup failed: %s', err instanceof Error ? err.message : String(err))
            return ''
        }
    },

    async testConfig(): Promise<boolean> {
        try {
            const check = await window.electronAPI.chinese_dict.check()
            return check.ready
        } catch {
            return false
        }
    }
}
