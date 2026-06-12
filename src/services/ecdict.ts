import type { TranslateService, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const ECDICT_LANGUAGES: LanguageCode[] = ['auto', 'zh_cn', 'zh_tw', 'en']

export const ecdictService: TranslateService = {
    key: 'ecdict',
    name: 'CC-CEDICT',
    languages: ECDICT_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode
    ): Promise<string | DictResult> {
        try {
            const result = await window.electronAPI.dict.lookup(text, from)
            if (!result) return ''
            return result
        } catch {
            return ''
        }
    },

    async testConfig(): Promise<boolean> {
        try {
            const check = await window.electronAPI.dict.check()
            return check.ready
        } catch {
            return false
        }
    }
}
