import type { TranslateService, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const ECDICT_LANGUAGES: LanguageCode[] = ['auto', 'zh_cn', 'zh_tw', 'en']

export const ecdictService: TranslateService = {
    key: 'ecdict',
    name: 'CC-CEDICT',
    languages: ECDICT_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode
    ): Promise<string | DictResult> {
        const result = await window.electronAPI.dict.lookup(text, from, to)
        if (!result) return ''
        return result
    },

    async testConfig(): Promise<boolean> {
        const check = await window.electronAPI.dict.check()
        return check.ready
    }
}
