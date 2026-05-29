import { ipcMain } from 'electron'
import type { HistoryRecord, HistoryQueryFilters } from '../history'
import {
    add_history,
    get_history_page,
    get_history_count,
    get_history_service_keys,
    update_history,
    delete_history,
    clear_history
} from '../history'

type AddHistoryRecord = Omit<HistoryRecord, 'id' | 'created_at'>

function is_add_history_record(value: unknown): value is AddHistoryRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    return typeof record.service_key === 'string'
        && typeof record.source_text === 'string'
        && typeof record.source_lang === 'string'
        && typeof record.target_text === 'string'
        && typeof record.target_lang === 'string'
}

export function registerHistoryHandlers(): void {
    ipcMain.handle('history:add', (_event, record: unknown) => {
        if (!is_add_history_record(record)) return
        add_history(record)
    })

    ipcMain.handle('history:list', (_event, page: number, page_size: number, filters?: HistoryQueryFilters) => {
        const safe_page = Math.max(1, page || 1)
        const safe_page_size = Math.min(100, Math.max(1, page_size || 20))
        return get_history_page(safe_page, safe_page_size, filters)
    })

    ipcMain.handle('history:count', (_event, filters?: HistoryQueryFilters) => {
        return get_history_count(filters)
    })

    ipcMain.handle('history:service-keys', () => {
        return get_history_service_keys()
    })

    ipcMain.handle('history:update', (_event, id: number, source_text: string, target_text: string) => {
        update_history(id, source_text, target_text)
    })

    ipcMain.handle('history:delete', (_event, id: number) => {
        delete_history(id)
    })

    ipcMain.handle('history:clear', () => {
        clear_history()
    })
}
