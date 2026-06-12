import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { log } from '../log'

const log_dict = log.scope('ecdict')

let db: Database.Database | undefined
let db_state: 'idle' | 'ready' | 'failed' = 'idle'
let cached_path: string | undefined
const stmt_cache = new Map<string, Database.Statement>()

function find_db_path(): string | null {
    if (cached_path) return cached_path
    if (app.isPackaged) {
        const prod_path = join(process.resourcesPath, 'data', 'dict', 'cc_cedict.db')
        return existsSync(prod_path) ? prod_path : null
    }
    const app_path = app.getAppPath()
    const candidates = [
        join(app_path, 'data', 'dict', 'cc_cedict.db'),
        join(app_path, '..', 'data', 'dict', 'cc_cedict.db'),
        join(app_path, '..', '..', 'data', 'dict', 'cc_cedict.db'),
        join(process.cwd(), 'data', 'dict', 'cc_cedict.db'),
    ]
    return candidates.find((path) => existsSync(path)) ?? null
}

function open_db(): Database.Database | null {
    if (db_state === 'failed') return null
    if (db) return db
    const path = find_db_path()
    if (!path) {
        db_state = 'failed'
        log_dict.warn('cc_cedict.db not found')
        return null
    }
    try {
        db = new Database(path, { readonly: true })
        cached_path = path
        db_state = 'ready'
        stmt_cache.clear()
        stmt_cache.set('lookup_chinese', db.prepare(
            'SELECT simplified, traditional, pinyin, english FROM entries WHERE simplified = ? OR traditional = ?'
        ))
        stmt_cache.set('lookup_english', db.prepare(
            `SELECT simplified, traditional, pinyin, english
             FROM entries
             WHERE english LIKE ?
             LIMIT 20`
        ))
        stmt_cache.set('count', db.prepare('SELECT COUNT(*) as count FROM entries'))
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

export function get_entry_count(): number {
    const database = open_db()
    if (!database) return 0
    const stmt = stmt_cache.get('count') ?? database.prepare('SELECT COUNT(*) as count FROM entries')
    const row = stmt.get() as { count: number }
    return row.count
}

export interface DictLookupResult {
    simplified: string
    traditional: string
    pinyin: string
    definitions: string[]
}

export function lookup_chinese(word: string): DictLookupResult[] {
    const database = open_db()
    if (!database) return []
    const stmt = stmt_cache.get('lookup_chinese') ?? database.prepare(
        'SELECT simplified, traditional, pinyin, english FROM entries WHERE simplified = ? OR traditional = ?'
    )
    const rows = stmt.all(word, word) as Array<{ simplified: string; traditional: string; pinyin: string; english: string }>
    return rows.map((row) => ({
        simplified: row.simplified,
        traditional: row.traditional,
        pinyin: row.pinyin,
        definitions: row.english.split('/').filter(Boolean)
    }))
}

export function lookup_english(word: string): DictLookupResult[] {
    const database = open_db()
    if (!database) return []
    const stmt = stmt_cache.get('lookup_english') ?? database.prepare(
        `SELECT simplified, traditional, pinyin, english
         FROM entries
         WHERE english LIKE ?
         LIMIT 20`
    )
    const rows = stmt.all(`%${word}%`) as Array<{ simplified: string; traditional: string; pinyin: string; english: string }>
    return rows.map((row) => ({
        simplified: row.simplified,
        traditional: row.traditional,
        pinyin: row.pinyin,
        definitions: row.english.split('/').filter(Boolean)
    }))
}

export function close_dict(): void {
    if (db) {
        db.close()
        db = undefined
    }
    db_state = 'idle'
    cached_path = undefined
    stmt_cache.clear()
}
