import { ipcMain } from 'electron'
import {
    add_history,
    get_history_page,
    get_history_count,
    update_history,
    delete_history,
    clear_history
} from '../history'

export function registerHistoryHandlers(): void {
    ipcMain.handle('history:add', (_event, record) => {
        add_history(record)
    })

    ipcMain.handle('history:list', (_event, page: number, page_size: number) => {
        return get_history_page(page, page_size)
    })

    ipcMain.handle('history:count', () => {
        return get_history_count()
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
