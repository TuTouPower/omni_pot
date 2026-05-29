import { join } from 'path'
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
let db_mutex = false

function get_db(): Database.Database {
    if (db) return db

    // Simple mutex to prevent concurrent initialization
    if (db_mutex) {
        throw new Error('Database is being reinitialized')
    }
    db_mutex = true

    try {
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
    } finally {
        db_mutex = false
    }
}

/**
 * Reset database connection (used by backup restore)
 */
export function reset_db(): void {
    if (db) {
        db.close()
        db = undefined
    }
}

export function add_history(record: Omit<HistoryRecord, 'id' | 'created_at'>): void {
    get_db().prepare(
        'INSERT INTO history (service_key, source_text, source_lang, target_text, target_lang) VALUES (?, ?, ?, ?, ?)'
    ).run(record.service_key, record.source_text, record.source_lang, record.target_text, record.target_lang)
}

export interface HistoryQueryFilters {
    search?: string
    service_key?: string
    days?: number
}

function build_where_clause(filters?: HistoryQueryFilters): { clause: string; params: unknown[] } {
    const conditions: string[] = []
    const params: unknown[] = []
    if (filters?.search) {
        conditions.push('(source_text LIKE ? OR target_text LIKE ?)')
        const pattern = `%${filters.search}%`
        params.push(pattern, pattern)
    }
    if (filters?.service_key) {
        conditions.push('service_key = ?')
        params.push(filters.service_key)
    }
    if (filters?.days && filters.days > 0) {
        conditions.push("created_at >= datetime('now', 'localtime', ?)")
        params.push(`-${String(filters.days)} days`)
    }
    const clause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
    return { clause, params }
}

export function get_history_page(page: number, page_size: number, filters?: HistoryQueryFilters): HistoryRecord[] {
    const offset = (page - 1) * page_size
    const { clause, params } = build_where_clause(filters)
    return get_db().prepare(
        `SELECT * FROM history${clause} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(...params, page_size, offset) as HistoryRecord[]
}

export function get_history_count(filters?: HistoryQueryFilters): number {
    const { clause, params } = build_where_clause(filters)
    const row = get_db().prepare(`SELECT COUNT(*) as count FROM history${clause}`).get(...params) as { count: number }
    return row.count
}

export function get_history_service_keys(): string[] {
    const rows = get_db().prepare('SELECT DISTINCT service_key FROM history ORDER BY service_key ASC').all() as Array<{ service_key: string }>
    return rows.map((row) => row.service_key)
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
