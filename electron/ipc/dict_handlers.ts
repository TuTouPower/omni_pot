import { ipcMain } from 'electron'
import * as https from 'https'
import { createGunzip } from 'zlib'
import {
    import_from_text,
    is_ready,
    get_entry_count,
    lookup_chinese,
    lookup_english,
    type DictLookupResult
} from '../dict'

const DEFAULT_CEDICT_URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'

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
        // English → Chinese: show Chinese characters as meanings
        for (const entry of entries) {
            meanings.push(`${entry.simplified} (${entry.pinyin})`)
            if (meanings.length >= 10) break
        }
    } else {
        // Chinese → English: show English definitions as meanings
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

function download_text(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'omni_pot' } }, (resp) => {
            if (resp.statusCode === 301 || resp.statusCode === 302) {
                const redirect_url = resp.headers.location
                if (!redirect_url) { reject(new Error('Redirect without location')); return; }
                download_text(redirect_url).then(resolve).catch(reject)
                return
            }
            if (resp.statusCode !== 200) {
                reject(new Error(`HTTP ${String(resp.statusCode)}`)); return;
            }

            const is_gzip = url.endsWith('.gz') || (resp.headers['content-encoding'] === 'gzip')
            const stream = is_gzip ? resp.pipe(createGunzip()) : resp
            const chunks: Buffer[] = []

            stream.on('data', (chunk: Buffer) => chunks.push(chunk))
            stream.on('end', () => { resolve(Buffer.concat(chunks).toString('utf-8')); })
            stream.on('error', reject)
        }).on('error', reject)
    })
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

    ipcMain.handle('dict:import', async (_event, url?: string) => {
        try {
            const download_url = url || DEFAULT_CEDICT_URL
            const text = await download_text(download_url)
            const count = import_from_text(text)
            return { success: true, entry_count: count }
        } catch (err) {
            return { success: false, error: String(err) }
        }
    })
}
