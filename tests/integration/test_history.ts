import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'

describe('History Store - SQLite integration', () => {
    const test_dir = join(tmpdir(), 'pot-test-history-' + Date.now())
    let db: Database.Database

    beforeEach(() => {
        mkdirSync(test_dir, { recursive: true })
        db = new Database(join(test_dir, 'history.db'))
        db.pragma('journal_mode = WAL')
        db.exec(`
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_key TEXT NOT NULL,
                source_text TEXT NOT NULL,
                source_lang TEXT NOT NULL DEFAULT '',
                target_text TEXT NOT NULL DEFAULT '',
                target_lang TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
        `)
    })

    afterEach(() => {
        db.close()
        rmSync(test_dir, { recursive: true, force: true })
    })

    it('inserts and retrieves a record', () => {
        db.prepare(
            'INSERT INTO history (service_key, source_text, source_lang, target_text, target_lang) VALUES (?, ?, ?, ?, ?)'
        ).run('bing@default', 'hello', 'en', '你好', 'zh_cn')

        const rows = db.prepare('SELECT * FROM history').all() as Array<Record<string, unknown>>
        expect(rows).toHaveLength(1)
        expect(rows[0].source_text).toBe('hello')
        expect(rows[0].target_text).toBe('你好')
    })

    it('paginates results', () => {
        const insert = db.prepare(
            'INSERT INTO history (service_key, source_text, source_lang, target_text, target_lang) VALUES (?, ?, ?, ?, ?)'
        )
        for (let i = 0; i < 25; i++) {
            insert.run('bing@default', `text ${i}`, 'en', `翻译 ${i}`, 'zh_cn')
        }

        const page1 = db.prepare('SELECT * FROM history ORDER BY id DESC LIMIT 10 OFFSET 0').all()
        expect(page1).toHaveLength(10)

        const page3 = db.prepare('SELECT * FROM history ORDER BY id DESC LIMIT 10 OFFSET 20').all()
        expect(page3).toHaveLength(5)
    })

    it('counts records', () => {
        const insert = db.prepare(
            'INSERT INTO history (service_key, source_text, source_lang, target_text, target_lang) VALUES (?, ?, ?, ?, ?)'
        )
        insert.run('bing@default', 'a', 'en', 'A', 'zh_cn')
        insert.run('bing@default', 'b', 'en', 'B', 'zh_cn')

        const row = db.prepare('SELECT COUNT(*) as count FROM history').get() as { count: number }
        expect(row.count).toBe(2)
    })

    it('updates a record', () => {
        db.prepare(
            'INSERT INTO history (service_key, source_text, source_lang, target_text, target_lang) VALUES (?, ?, ?, ?, ?)'
        ).run('bing@default', 'hello', 'en', '你好', 'zh_cn')

        db.prepare('UPDATE history SET source_text = ?, target_text = ? WHERE id = ?').run('hi', '嗨', 1)

        const row = db.prepare('SELECT * FROM history WHERE id = 1').get() as Record<string, unknown>
        expect(row.source_text).toBe('hi')
        expect(row.target_text).toBe('嗨')
    })

    it('deletes a record', () => {
        db.prepare(
            'INSERT INTO history (service_key, source_text, source_lang, target_text, target_lang) VALUES (?, ?, ?, ?, ?)'
        ).run('bing@default', 'hello', 'en', '你好', 'zh_cn')

        db.prepare('DELETE FROM history WHERE id = ?').run(1)

        const rows = db.prepare('SELECT * FROM history').all()
        expect(rows).toHaveLength(0)
    })

    it('clears all records', () => {
        const insert = db.prepare(
            'INSERT INTO history (service_key, source_text, source_lang, target_text, target_lang) VALUES (?, ?, ?, ?, ?)'
        )
        insert.run('bing@default', 'a', 'en', 'A', 'zh_cn')
        insert.run('bing@default', 'b', 'en', 'B', 'zh_cn')

        db.exec('DELETE FROM history')

        const row = db.prepare('SELECT COUNT(*) as count FROM history').get() as { count: number }
        expect(row.count).toBe(0)
    })
})
