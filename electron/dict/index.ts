import { app } from 'electron'
import { join } from 'path'
import { existsSync, createReadStream } from 'fs'
import { createGunzip } from 'zlib'
import Database from 'better-sqlite3'
import { getUserDataDir } from '../config/store'

let db: Database.Database | undefined

function get_dict_db(): Database.Database {
    if (db) return db

    const dir = getUserDataDir()
    const db_path = join(dir, 'cc_cedict.db')

    db = new Database(db_path)
    db.pragma('journal_mode = WAL')

    init_db(db)

    return db
}

function init_db(database: Database.Database): void {
    database.exec(`
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            simplified TEXT NOT NULL,
            traditional TEXT NOT NULL,
            pinyin TEXT NOT NULL,
            english TEXT NOT NULL
        )
    `)

    database.exec(`
        CREATE INDEX IF NOT EXISTS idx_simplified ON entries(simplified);
        CREATE INDEX IF NOT EXISTS idx_traditional ON entries(traditional)
    `)

    const fts_exists = database.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='entries_fts'"
    ).get()
    if (!fts_exists) {
        database.exec(`
            CREATE VIRTUAL TABLE entries_fts USING fts5(
                simplified, traditional, english,
                content=entries, content_rowid=id
            )
        `)
    }
}

const CEDICT_LINE_RE = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/

export function import_from_text(text: string): number {
    const database = get_dict_db()
    const lines = text.split('\n')
    const insert = database.prepare(
        'INSERT INTO entries (simplified, traditional, pinyin, english) VALUES (?, ?, ?, ?)'
    )

    let count = 0
    const insert_many = database.transaction(() => {
        for (const line of lines) {
            if (line.startsWith('#') || !line.trim()) continue
            const match = CEDICT_LINE_RE.exec(line)
            if (!match) continue
            const [, traditional, simplified, pinyin, english] = match
            insert.run(simplified, traditional, pinyin, english)
            count++
        }
    })

    insert_many()

    database.exec('INSERT INTO entries_fts(entries_fts) VALUES("rebuild")')

    return count
}

function find_bundled_cedict(): string | null {
    // Production: process.resourcesPath/data/dict/cedict.txt.gz
    const prod_path = join(process.resourcesPath, 'data', 'dict', 'cedict.txt.gz')
    if (existsSync(prod_path)) return prod_path

    // Development: project root data/dict/cedict.txt.gz
    const dev_path = join(app.getAppPath(), 'data', 'dict', 'cedict.txt.gz')
    if (existsSync(dev_path)) return dev_path

    return null
}

function read_gzip_file(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        const stream = createReadStream(path).pipe(createGunzip())
        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
        stream.on('error', reject)
    })
}

export async function auto_import_if_needed(): Promise<void> {
    const database = get_dict_db()
    const row = database.prepare('SELECT COUNT(*) as count FROM entries LIMIT 1').get() as { count: number }
    if (row.count > 0) return

    const bundled = find_bundled_cedict()
    if (!bundled) return

    const text = await read_gzip_file(bundled)
    const count = import_from_text(text)
    console.log(`[dict] imported ${count} CC-CEDICT entries from bundled file`)
}

export function is_ready(): boolean {
    const database = get_dict_db()
    const row = database.prepare('SELECT COUNT(*) as count FROM entries LIMIT 1').get() as { count: number }
    return row.count > 0
}

export function get_entry_count(): number {
    const database = get_dict_db()
    const row = database.prepare('SELECT COUNT(*) as count FROM entries').get() as { count: number }
    return row.count
}

export interface DictLookupResult {
    simplified: string
    traditional: string
    pinyin: string
    definitions: string[]
}

export function lookup_chinese(word: string): DictLookupResult[] {
    const database = get_dict_db()
    const rows = database.prepare(
        'SELECT simplified, traditional, pinyin, english FROM entries WHERE simplified = ? OR traditional = ?'
    ).all(word, word) as Array<{ simplified: string; traditional: string; pinyin: string; english: string }>

    return rows.map((row) => ({
        simplified: row.simplified,
        traditional: row.traditional,
        pinyin: row.pinyin,
        definitions: row.english.split('/').filter(Boolean)
    }))
}

export function lookup_english(word: string): DictLookupResult[] {
    const database = get_dict_db()
    const rows = database.prepare(
        `SELECT e.simplified, e.traditional, e.pinyin, e.english
         FROM entries e
         WHERE e.english LIKE ?
         LIMIT 20`
    ).all(`%${word}%`) as Array<{ simplified: string; traditional: string; pinyin: string; english: string }>

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
}
