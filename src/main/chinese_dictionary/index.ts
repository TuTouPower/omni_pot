import { join } from 'path'
import { existsSync } from 'fs'
import { app, BrowserWindow } from 'electron'
import Database from 'better-sqlite3'
import { log } from '../log'
import type { ChineseDictServiceState } from '@shared/types/ipc'

const log_dict = log.scope('chinese-dictionary')

type DbState = 'idle' | 'ready' | 'failed'

let db: Database.Database | undefined
let db_state: DbState = 'idle'
let cached_path: string | undefined
let service_state: ChineseDictServiceState = 'missing'
const stmt_cache = new Map<string, Database.Statement>()

interface WordRow {
    word: string
    pinyin: string
    explanation: string
}

interface CharRow {
    char: string
    pinyin: string
    explanation: string
    speech: string | null
    words: string | null
}

interface IdiomRow {
    word: string
    pinyin: string
    explanation: string
    source: string | null
    example: string | null
    similar: string | null
    opposite: string | null
}

export function get_db_path(): string | null {
    if (cached_path) return cached_path
    return find_db_path()
}

function find_db_path(): string | null {
    if (app.isPackaged) {
        const prod_path = join(process.resourcesPath, 'data', 'dict', 'chinese_dictionary.db')
        return existsSync(prod_path) ? prod_path : null
    }

    const app_path = app.getAppPath()
    const candidates = [
        join(app_path, 'resources', 'data', 'dict', 'chinese_dictionary.db'),
        join(app_path, '..', 'resources', 'data', 'dict', 'chinese_dictionary.db'),
        join(app_path, '..', '..', 'resources', 'data', 'dict', 'chinese_dictionary.db'),
        join(process.cwd(), 'resources', 'data', 'dict', 'chinese_dictionary.db'),
    ]
    return candidates.find((path) => existsSync(path)) ?? null
}

function open_db(): Database.Database | null {
    if (db_state === 'failed') return null
    if (db) return db

    const path = cached_path ?? find_db_path()
    if (!path) {
        db_state = 'failed'
        log_dict.warn('db file not found in any candidate path')
        return null
    }

    try {
        db = new Database(path, { readonly: true })

        const meta = db.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get() as { value: string } | undefined
        if (!meta || meta.value !== '1') {
            log_dict.error('schema version mismatch: expected 1, got %s', meta?.value ?? 'missing')
            db.close()
            db = undefined
            db_state = 'failed'
            return null
        }

        cached_path = path
        db_state = 'ready'

        stmt_cache.clear()
        stmt_cache.set('count_words', db.prepare('SELECT COUNT(*) as count FROM words'))
        stmt_cache.set('lookup_word', db.prepare('SELECT word, pinyin, explanation FROM words WHERE word = ?'))
        stmt_cache.set('lookup_idiom', db.prepare('SELECT word, pinyin, explanation, source, example, similar, opposite FROM idioms WHERE word = ?'))
        stmt_cache.set('lookup_char', db.prepare('SELECT char, pinyin, explanation, speech, words FROM characters WHERE char = ?'))
        stmt_cache.set('fts_search', db.prepare(`
            SELECT words.word, words.pinyin, words.explanation
            FROM words_fts
            JOIN words ON words.id = words_fts.rowid
            WHERE words_fts MATCH ?
            ORDER BY bm25(words_fts), length(words.word)
            LIMIT ?
        `))

        log_dict.info('db opened: %s', path)
        return db
    } catch (e) {
        log_dict.error('failed to open db: %s', e)
        db = undefined
        db_state = 'failed'
        return null
    }
}

export function is_ready(): boolean {
    return open_db() !== null
}

export function get_service_state(): ChineseDictServiceState {
    return service_state
}

export function set_service_state(state: ChineseDictServiceState): void {
    if (service_state === state) return
    service_state = state
    // Broadcast to currently-open windows. Renderers mounted later see the
    // current state via the `chinese_dict:check` IPC on mount.
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send('chinese-dictionary:state-changed', state)
        }
    }
}

export function get_entry_count(): number {
    const database = open_db()
    if (!database) return 0
    const stmt = stmt_cache.get('count_words') ?? database.prepare('SELECT COUNT(*) as count FROM words')
    const row = stmt.get() as { count: number }
    return row.count
}

export function lookup_word(text: string): WordRow | null {
    const database = open_db()
    if (!database) return null
    const stmt = stmt_cache.get('lookup_word') ?? database.prepare('SELECT word, pinyin, explanation FROM words WHERE word = ?')
    return stmt.get(text) as WordRow | null
}

export function lookup_idiom(text: string): IdiomRow | null {
    const database = open_db()
    if (!database) return null
    const stmt = stmt_cache.get('lookup_idiom') ?? database.prepare('SELECT word, pinyin, explanation, source, example, similar, opposite FROM idioms WHERE word = ?')
    return stmt.get(text) as IdiomRow | null
}

export function lookup_character(text: string): CharRow | null {
    const database = open_db()
    if (!database) return null
    const stmt = stmt_cache.get('lookup_char') ?? database.prepare('SELECT char, pinyin, explanation, speech, words FROM characters WHERE char = ?')
    return stmt.get(text) as CharRow | null
}

export function fts_search(prefix: string, limit = 5): WordRow[] {
    const database = open_db()
    if (!database) return []
    const cleaned = prefix.replace(/[^\p{Script=Han}a-zA-Z0-9]/gu, '')
    if (!cleaned) return []
    // FTS5 prefix search with single character is slow on large databases
    // Require at least 2 characters for prefix search
    if (cleaned.length < 2) return []
    const query = `${cleaned}*`
    const stmt = stmt_cache.get('fts_search') ?? database.prepare(`
        SELECT words.word, words.pinyin, words.explanation
        FROM words_fts
        JOIN words ON words.id = words_fts.rowid
        WHERE words_fts MATCH ?
        ORDER BY bm25(words_fts), length(words.word)
        LIMIT ?
    `)
    return stmt.all(query, limit) as WordRow[]
}

export function reload_db(): boolean {
    if (db) {
        db.close()
        db = undefined
    }
    db_state = 'idle'
    cached_path = undefined
    stmt_cache.clear()
    const success = is_ready()
    if (success) {
        service_state = 'ready'
    } else if (service_state === 'ready') {
        service_state = 'failed'
    }
    return success
}

export function close_chinese_dictionary(): void {
    if (db) {
        db.close()
        db = undefined
    }
    db_state = 'idle'
}
