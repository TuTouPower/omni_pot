import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, statSync } from 'fs'
import { join } from 'path'

const DB_PATH = join(__dirname, '..', '..', 'resources', 'data', 'dict', 'chinese_dict.db')
const LICENSE_PATH = join(__dirname, '..', '..', 'resources', 'data', 'dict', 'chinese-dictionary-LICENSE')

describe('chinese_dict build', () => {
    let db: Database.Database

    beforeAll(() => {
        if (!existsSync(DB_PATH)) {
            throw new Error(
                `chinese_dict.db not found at ${DB_PATH}.\n` +
                'Run `npm run build:chinese-dict` first, then re-run this test.'
            )
        }
        db = new Database(DB_PATH, { readonly: true })
    })

    afterAll(() => {
        db.close()
    })

    it('LICENSE file exists when db is built', () => {
        expect(existsSync(LICENSE_PATH)).toBe(true)
    })

    it('has metadata table with correct entries', () => {
        const meta = db.prepare('SELECT * FROM metadata').all() as Array<{ key: string; value: string }>
        const map = new Map(meta.map(m => [m.key, m.value]))
        expect(map.get('schema_version')).toBe('1')
        expect(map.get('source')).toBe('mapull/chinese-dictionary')
        expect(map.has('build_time')).toBe(true)
        expect(map.has('source_commit')).toBe(true)
    })

    it('words table has expected range', () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM words').get() as { count: number }
        expect(row.count).toBeGreaterThan(300000)
        expect(row.count).toBeLessThan(500000)
    })

    it('characters table has expected range', () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM characters').get() as { count: number }
        expect(row.count).toBeGreaterThan(15000)
        expect(row.count).toBeLessThan(30000)
    })

    it('idioms table has expected range', () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM idioms').get() as { count: number }
        expect(row.count).toBeGreaterThan(45000)
        expect(row.count).toBeLessThan(60000)
    })

    it('words table sample entry has correct fields', () => {
        const row = db.prepare('SELECT word, pinyin, explanation FROM words WHERE word = ?').get('学习') as { word: string; pinyin: string; explanation: string } | undefined
        expect(row).toBeDefined()
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(row!.word).toBe('学习')
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(row!.pinyin).toBeTruthy()
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(row!.explanation).toBeTruthy()
    })

    it('characters table has structured explanation JSON', () => {
        const row = db.prepare('SELECT char, pinyin, explanation FROM characters WHERE char = ?').get('行') as { char: string; pinyin: string; explanation: string } | undefined
        expect(row).toBeDefined()
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment
        const pinyins: string[] = JSON.parse(row!.pinyin)
        expect(pinyins.length).toBeGreaterThanOrEqual(2)
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment
        const explanations: Array<{ pinyin: string; speech: string; content: string }> = JSON.parse(row!.explanation)
        expect(explanations.length).toBeGreaterThanOrEqual(2)
    })

    it('FTS prefix search works', () => {
        const rows = db.prepare(
            "SELECT word FROM words_fts WHERE word MATCH ? LIMIT 5"
        ).all('莫名其*') as Array<{ word: string }>
        expect(rows.some(r => r.word === '莫名其妙')).toBe(true)
    })

    it('FTS fullwidth punctuation does not throw', () => {
        expect(() => {
            db.prepare("SELECT word FROM words_fts WHERE word MATCH ? LIMIT 5").all('你好，世界！*')
        }).not.toThrow()
    })

    it('db size is within limits', () => {
        const size_mb = statSync(DB_PATH).size / (1024 * 1024)
        expect(size_mb).toBeLessThan(150)
    })
})
