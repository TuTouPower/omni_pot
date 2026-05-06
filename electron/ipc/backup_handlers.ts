import { ipcMain, dialog, BrowserWindow } from 'electron'
import {
    create_local_backup,
    list_local_backups,
    restore_local_backup
} from '../backup'

export function registerBackupHandlers(): void {
    ipcMain.handle('backup:create', async () => {
        try {
            const path = create_local_backup()
            return { success: true, path }
        } catch (err) {
            return { success: false, error: String(err) }
        }
    })

    ipcMain.handle('backup:list', () => {
        return list_local_backups()
    })

    ipcMain.handle('backup:restore', async (_event, name: string) => {
        try {
            restore_local_backup(name)
            return { success: true }
        } catch (err) {
            return { success: false, error: String(err) }
        }
    })
}
