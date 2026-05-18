/**
 * Pre-builds the CC-CEDICT SQLite database from the bundled `data/dict/cedict.txt.gz`
 * and writes it to `resources/data/dict/cc_cedict.db` so the packaged app can ship
 * a query-ready DB instead of importing on first launch.
 *
 * Output is gitignored alongside chinese_dict.db.
 */

import { createReadStream, existsSync, mkdirSync, rmSync } from 'fs'
import { createGunzip } from 'zlib'
import { join } from 'path'
import Database from 'better-sqlite3'

const SRC = join(process.cwd(), 'data', 'dict', 'cedict.txt.gz')
const OUT_DIR = join(process.cwd(), 'resources', 'data', 'dict')
const OUT_DB = join(OUT_DIR, 'cc_cedict.db')

const CEDICT_LINE_RE = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/

function read_gzip_text(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        const stream = createReadStream(path).pipe(createGunzip())
        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('end', () => { resolve(Buffer.concat(chunks).toString('utf-8')) })
        stream.on('error', reject)
    })
}

async function main(): Promise<void> {
    if (!existsSync(SRC)) {
        console.error(`[build:cc-cedict] missing source: ${SRC}`)
        process.exit(1)
    }
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
    if (existsSync(OUT_DB)) rmSync(OUT_DB)

    console.log('[build:cc-cedict] reading and decompressing cedict.txt.gz...')
    const text = await read_gzip_text(SRC)

    console.log('[build:cc-cedict] building cc_cedict.db...')
    const db = new Database(OUT_DB)
    db.pragma('journal_mode = DELETE') // ship a single .db file, no WAL/SHM sidecars
    db.exec(`
        CREATE TABLE entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            simplified TEXT NOT NULL,
            traditional TEXT NOT NULL,
            pinyin TEXT NOT NULL,
            english TEXT NOT NULL
        );
        CREATE INDEX idx_simplified ON entries(simplified);
        CREATE INDEX idx_traditional ON entries(traditional);
        CREATE VIRTUAL TABLE entries_fts USING fts5(
            simplified, traditional, english,
            content=entries, content_rowid=id
        );
    `)

    const insert = db.prepare(
        'INSERT INTO entries (simplified, traditional, pinyin, english) VALUES (?, ?, ?, ?)'
    )

    let count = 0
    const insert_many = db.transaction((lines: string[]) => {
        for (const raw of lines) {
            const line = raw.trim()
            if (!line || line.startsWith('#')) continue
            const m = CEDICT_LINE_RE.exec(line)
            if (!m) continue
            const [, traditional, simplified, pinyin, english] = m
            insert.run(simplified, traditional, pinyin, english)
            count++
        }
    })
    insert_many(text.split('\n'))

    db.exec("INSERT INTO entries_fts(entries_fts) VALUES('rebuild')")
    db.exec('VACUUM')
    db.close()

    console.log(`[build:cc-cedict] wrote ${OUT_DB} (${count} entries)`)
}

main().catch((err: unknown) => {
    console.error('[build:cc-cedict] failed:', err)
    process.exit(1)
})
