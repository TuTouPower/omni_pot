import type { TranslateService, DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const CHINESE_DICTIONARY_LANGUAGES: LanguageCode[] = ['auto', 'zh_cn']

const CHARACTER_ENTRIES: Partial<Record<string, DictResult>> = {
    '你': {
        type: 'dict',
        pronunciations: [{ region: '普通话', phonetic: 'nǐ' }],
        definitions: [
            { partOfSpeech: '代词', meanings: ['称对方，多用于一人，也可泛指任何人。'] }
        ],
        examples: [{ source: '你好。', target: '' }]
    },
    '好': {
        type: 'dict',
        pronunciations: [{ region: '普通话', phonetic: 'hǎo' }],
        definitions: [
            { partOfSpeech: '形容词', meanings: ['优点多的；使人满意的。'] },
            { partOfSpeech: '动词', meanings: ['表示完成或达到完善的状态。'] }
        ],
        examples: [{ source: '这是一件好事。', target: '' }]
    }
}

const WORD_ENTRIES: Partial<Record<string, DictResult>> = {
    '你好': {
        type: 'dict',
        pronunciations: [{ region: '普通话', phonetic: 'nǐ hǎo' }],
        definitions: [
            { partOfSpeech: '寒暄语', meanings: ['用于见面、通信或通话时表示问候。'] }
        ],
        examples: [{ source: '你好，很高兴见到你。', target: '' }]
    }
}

function is_chinese_text(text: string): boolean {
    return /[㐀-鿿]/.test(text)
}

function make_unknown_entry(word: string): DictResult {
    return {
        type: 'dict',
        pronunciations: [],
        definitions: [
            { partOfSpeech: word.length === 1 ? '字' : '词语', meanings: ['暂无内置释义。'] }
        ],
        examples: []
    }
}

export const chineseDictionaryService: TranslateService = {
    key: 'chinese_dictionary',
    name: '中文词典',
    languages: CHINESE_DICTIONARY_LANGUAGES,

    translate(text: string): Promise<string | DictResult> {
        const word = text.trim().replace(/\s+/g, '')
        if (!word || !is_chinese_text(word)) return Promise.resolve('')
        return Promise.resolve(WORD_ENTRIES[word] ?? CHARACTER_ENTRIES[word] ?? make_unknown_entry(word))
    },

    async testConfig(): Promise<boolean> {
        const result = await this.translate('你好', 'zh_cn', 'zh_cn', {})
        return typeof result === 'object' && result.definitions.length > 0
    }
}
