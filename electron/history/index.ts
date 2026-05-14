import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import Database from 'better-sqlite3'
import { getUserDataDir } from '../config/store'

export interface HistoryRecord {
    id: number
    service_key: string
    source_text: string
    source_lang: string
    target_text: string
    target_lang: string
    created_at: string
}

let db: Database.Database | undefined

function get_db(): Database.Database {
    if (db) return db

    const dir = getUserDataDir()
    const db_path = join(dir, 'history.db')

    db = new Database(db_path)
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

    return db
}

export function add_history(record: Omit<HistoryRecord, 'id' | 'created_at'>): void {
    get_db().prepare(
        'INSERT INTO history (service_key, source_text, source_lang, target_text, target_lang) VALUES (?, ?, ?, ?, ?)'
    ).run(record.service_key, record.source_text, record.source_lang, record.target_text, record.target_lang)
}

export function get_history_page(page: number, page_size: number): HistoryRecord[] {
    const offset = (page - 1) * page_size
    return get_db().prepare(
        'SELECT * FROM history ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(page_size, offset) as HistoryRecord[]
}

export function get_history_count(): number {
    const row = get_db().prepare('SELECT COUNT(*) as count FROM history').get() as { count: number }
    return row.count
}

export function update_history(id: number, source_text: string, target_text: string): void {
    get_db().prepare(
        'UPDATE history SET source_text = ?, target_text = ? WHERE id = ?'
    ).run(source_text, target_text, id)
}

export function delete_history(id: number): void {
    get_db().prepare('DELETE FROM history WHERE id = ?').run(id)
}

export function clear_history(): void {
    get_db().exec('DELETE FROM history')
}

export function close_history(): void {
    if (db) {
        db.close()
        db = undefined
    }
}
