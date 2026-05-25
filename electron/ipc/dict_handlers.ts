import { ipcMain } from 'electron'
import {
    is_ready,
    get_entry_count,
    lookup_chinese,
    lookup_english,
    type DictLookupResult
} from '../dict'

interface DictResult {
    type: 'dict'
    pronunciations: Array<{ region: string; phonetic: string }>
    definitions: Array<{ partOfSpeech: string; meanings: string[] }>
    examples: Array<{ source: string; target: string }>
}

function to_dict_result(entries: DictLookupResult[], is_en_to_zh: boolean): DictResult | null {
    if (entries.length === 0) return null

    const pronunciations: DictResult['pronunciations'] = []
    const meanings: string[] = []

    if (is_en_to_zh) {
        for (const entry of entries) {
            meanings.push(`${entry.simplified} (${entry.pinyin})`)
            if (meanings.length >= 10) break
        }
    } else {
        for (const entry of entries) {
            for (const def of entry.definitions) {
                if (!meanings.includes(def)) {
                    meanings.push(def)
                }
                if (meanings.length >= 10) break
            }
        }
        const first_entry = entries.at(0)
        if (first_entry?.pinyin) {
            pronunciations.push({ region: '', phonetic: first_entry.pinyin })
        }
    }

    if (meanings.length === 0) return null

    return {
        type: 'dict',
        pronunciations,
        definitions: [{ partOfSpeech: is_en_to_zh ? 'zh' : 'en', meanings }],
        examples: []
    }
}

export function registerDictHandlers(): void {
    ipcMain.handle('dict:lookup', (_event, text: string, from: string) => {
        if (!is_ready()) return null

        const word = text.trim().split(/\s+/)[0]
        if (!word) return null

        const is_en_to_zh = from === 'en' || (from === 'auto' && /^[a-zA-Z]/.test(word))

        if (is_en_to_zh) {
            const entries = lookup_english(word)
            return to_dict_result(entries, true)
        } else {
            const entries = lookup_chinese(word)
            return to_dict_result(entries, false)
        }
    })

    ipcMain.handle('dict:check', () => {
        const ready = is_ready()
        return { ready, entry_count: ready ? get_entry_count() : 0 }
    })
}
