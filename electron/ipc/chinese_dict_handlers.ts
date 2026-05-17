import { ipcMain } from 'electron'
import {
    lookup_word,
    lookup_idiom,
    lookup_character,
    fts_search,
    is_ready,
    get_entry_count,
    get_service_state,
    reload_db,
} from '../chinese_dict'
import { getConfig } from '../config/store'
import { log } from '../log'
import type { DictResult } from '@shared/types/service'

const log_chinese_dict_ipc = log.scope('chinese-dict-ipc')

interface ExplanationEntry {
    pinyin: string
    speech: string
    content: string
}

function to_dict_result_word(row: { word: string; pinyin: string; explanation: string }): DictResult {
    return {
        type: 'dict',
        pronunciations: [{ region: '普通话', phonetic: row.pinyin }],
        definitions: [{ partOfSpeech: '', meanings: [row.explanation] }],
        examples: [],
    }
}

function to_dict_result_char(row: {
    char: string; pinyin: string; explanation: string; speech: string | null; words: string | null
}): DictResult | null {
    let pinyins: string[]
    let explanations: ExplanationEntry[]
    try {
        pinyins = JSON.parse(row.pinyin) as string[]
        explanations = JSON.parse(row.explanation) as ExplanationEntry[]
    } catch {
        return null
    }

    const grouped = new Map<string, ExplanationEntry[]>()
    for (const e of explanations) {
        const arr = grouped.get(e.pinyin) ?? []
        arr.push(e)
        grouped.set(e.pinyin, arr)
    }

    const definitions: DictResult['definitions'] = []
    for (const [, items] of grouped) {
        definitions.push({
            partOfSpeech: items.map(i => i.speech).filter(Boolean).join('、'),
            meanings: items.map(i => i.content),
        })
    }

    const examples: DictResult['examples'] = []
    if (row.words) {
        try {
            const words_arr = JSON.parse(row.words) as Array<{ word: string; text: string }>
            for (const w of words_arr.slice(0, 3)) {
                examples.push({ source: `${w.word}：${w.text}`, target: '' })
            }
        } catch {
            // malformed words JSON — skip
        }
    }

    return {
        type: 'dict',
        pronunciations: pinyins.map(p => ({ region: '普通话', phonetic: p })),
        definitions,
        examples,
    }
}

function to_dict_result_idiom(row: {
    word: string; pinyin: string; explanation: string; example: string | null; source: string | null
}): DictResult {
    const examples: DictResult['examples'] = []
    if (row.source) {
        try {
            const src = JSON.parse(row.source) as { text?: string; book?: string }
            if (src.text) examples.push({ source: `【出处】${src.text}${src.book ? `（${src.book}）` : ''}`, target: '' })
        } catch {
            // malformed source JSON — skip
        }
    }
    if (row.example) {
        examples.push({ source: row.example, target: '' })
    }

    return {
        type: 'dict',
        pronunciations: [{ region: '普通话', phonetic: row.pinyin }],
        definitions: [{ partOfSpeech: '成语', meanings: [row.explanation] }],
        examples,
        // FUTURE: extend DictResult with idiom_meta?: { source, similar, opposite }
    }
}

function clean_for_exact(text: string): string {
    const stripped = text.replace(/[^\p{Script=Han}a-zA-Z0-9\s]/gu, '').trim()
    if (stripped.length === 0 || stripped.length > 100) return ''
    return stripped
}

function is_chinese(text: string): boolean {
    return /\p{Script=Han}/u.test(text)
}

export function registerChineseDictHandlers(): void {
    ipcMain.handle('chineseDict:lookup', (_event, text: string): DictResult | null => {
        try {
            const enabled = getConfig('dict_chinese_enabled')
            if (enabled === false) return null

            if (!is_ready()) return null

            const word = clean_for_exact(text)
            if (!word || !is_chinese(word)) return null

            if (word.length === 1) {
                const char_row = lookup_character(word)
                if (char_row) {
                    const char_result = to_dict_result_char(char_row)
                    // JSON.parse failure returns null — fall through to word table as degraded lookup
                    if (char_result) return char_result
                }
                const word_row = lookup_word(word)
                if (word_row) return to_dict_result_word(word_row)
                return null
            }

            const word_row = lookup_word(word)
            if (word_row) return to_dict_result_word(word_row)

            const idiom_row = lookup_idiom(word)
            if (idiom_row) return to_dict_result_idiom(idiom_row)

            const fts_results = fts_search(word)
            if (fts_results.length > 0 && fts_results[0]) return to_dict_result_word(fts_results[0])

            return null
        } catch (e) {
            log_chinese_dict_ipc.error('lookup failed: %s', e)
            return null
        }
    })

    ipcMain.handle('chineseDict:check', () => {
        const state = get_service_state()
        return {
            ready: state === 'ready',
            status: state,
            entry_count: state === 'ready' ? get_entry_count() : 0,
        }
    })

    ipcMain.handle('chineseDict:reload', () => {
        return { success: reload_db() }
    })
}
