import { ipcMain } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
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
import { assert_sender_label } from './sender_validation'

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

export function registerHistoryHandlers(manager: WindowManager): void {
    ipcMain.handle('history:add', (event, record: unknown) => {
        assert_sender_label(manager, event, [WindowLabel.TRANSLATE], 'history:add')
        if (!is_add_history_record(record)) return
        add_history(record)
    })

    ipcMain.handle('history:list', (event, page: number, page_size: number, filters?: HistoryQueryFilters) => {
        assert_sender_label(manager, event, [WindowLabel.CONFIG], 'history:list')
        const safe_page = Math.max(1, page || 1)
        const safe_page_size = Math.min(100, Math.max(1, page_size || 20))
        return get_history_page(safe_page, safe_page_size, filters)
    })

    ipcMain.handle('history:count', (event, filters?: HistoryQueryFilters) => {
        assert_sender_label(manager, event, [WindowLabel.CONFIG], 'history:count')
        return get_history_count(filters)
    })

    ipcMain.handle('history:service-keys', (event) => {
        assert_sender_label(manager, event, [WindowLabel.CONFIG], 'history:service-keys')
        return get_history_service_keys()
    })

    ipcMain.handle('history:update', (event, id: number, source_text: string, target_text: string) => {
        assert_sender_label(manager, event, [WindowLabel.CONFIG], 'history:update')
        update_history(id, source_text, target_text)
    })

    ipcMain.handle('history:delete', (event, id: number) => {
        assert_sender_label(manager, event, [WindowLabel.CONFIG], 'history:delete')
        delete_history(id)
    })

    ipcMain.handle('history:clear', (event) => {
        assert_sender_label(manager, event, [WindowLabel.CONFIG], 'history:clear')
        clear_history()
    })
}
