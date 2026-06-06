import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const DB_PATH = join(__dirname, '..', '..', 'data', 'dict', 'cc_cedict.db')

describe('ecdict (CC-CEDICT)', () => {
    let db: Database.Database | undefined

    beforeAll(() => {
        if (!existsSync(DB_PATH)) {
            throw new Error(
                `cc_cedict.db not found at ${DB_PATH}.\n` +
                'The pre-built CC-CEDICT database must exist at data/dict/cc_cedict.db'
            )
        }
        db = new Database(DB_PATH, { readonly: true })
    })

    afterAll(() => {
        if (db) db.close()
    })

    it('db file exists', () => {
        expect(existsSync(DB_PATH)).toBe(true)
    })

    it('is included in electron-builder extraResources filter', () => {
        const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')) as {
            build?: { extraResources?: Array<{ from: string; to: string; filter?: string[] }> }
        }
        const extra_resources = pkg.build?.extraResources
        const dict_entry = extra_resources?.find((e) => e.from === 'data/dict/')
        expect(dict_entry?.filter).toContain('cc_cedict.db')
    })

    it('has entries table with expected columns', () => {
        const info = db.prepare("PRAGMA table_info('entries')").all() as Array<{ name: string }>
        const columns = info.map((c) => c.name)
        expect(columns).toContain('simplified')
        expect(columns).toContain('traditional')
        expect(columns).toContain('pinyin')
        expect(columns).toContain('english')
    })

    it('has entries_fts virtual table', () => {
        const row = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='entries_fts'"
        ).get() as { name: string } | undefined
        expect(row?.name).toBe('entries_fts')
    })

    it('has entries', () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM entries').get() as { count: number }
        expect(row.count).toBeGreaterThan(0)
    })

    it('looks up Chinese word by simplified', () => {
        const rows = db.prepare(
            'SELECT simplified, traditional, pinyin, english FROM entries WHERE simplified = ?'
        ).all('你好') as Array<{ simplified: string; traditional: string; pinyin: string; english: string }>
        expect(rows.length).toBeGreaterThan(0)
        expect(rows[0].pinyin).toBeTruthy()
        expect(rows[0].english).toBeTruthy()
    })

    it('looks up Chinese word by traditional', () => {
        const rows = db.prepare(
            'SELECT simplified, traditional, pinyin, english FROM entries WHERE traditional = ?'
        ).all('應用') as Array<{ simplified: string; traditional: string; pinyin: string; english: string }>
        expect(rows.length).toBeGreaterThan(0)
        expect(rows[0].simplified).toBe('应用')
    })

    it('looks up English word via english column LIKE', () => {
        const rows = db.prepare(
            'SELECT simplified, traditional, pinyin, english FROM entries WHERE english LIKE ? LIMIT 20'
        ).all('%hello%') as Array<{ simplified: string; traditional: string; pinyin: string; english: string }>
        expect(rows.length).toBeGreaterThan(0)
    })
})
