import { ipcMain, dialog } from 'electron'
import {
    create_local_backup,
    list_local_backups,
    list_local_backups_with_size,
    restore_local_backup,
    restore_from_zip_path,
    delete_local_backup,
    get_backup_path
} from '../backup'

export function registerBackupHandlers(): void {
    ipcMain.handle('backup:create', () => {
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

    ipcMain.handle('backup:restore', (_event, name: string) => {
        try {
            restore_local_backup(name)
            return { success: true }
        } catch (err) {
            return { success: false, error: String(err) }
        }
    })

    ipcMain.handle('backup:import', async () => {
        const result = await dialog.showOpenDialog({
            title: '导入备份',
            filters: [{ name: 'ZIP 文件', extensions: ['zip'] }],
            properties: ['openFile'],
        })
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: 'cancelled' }
        }
        try {
            const restored = restore_from_zip_path(result.filePaths[0]!)
            return { success: true, restored_files: restored.restored_files }
        } catch (err) {
            return { success: false, error: String(err) }
        }
    })

    ipcMain.handle('backup:list-with-size', () => {
        return list_local_backups_with_size()
    })

    ipcMain.handle('backup:delete', (_event, name: string) => {
        try {
            delete_local_backup(name)
            return { success: true }
        } catch (err) {
            return { success: false, error: String(err) }
        }
    })

    ipcMain.handle('backup:get-path', (_event, name: string) => {
        return get_backup_path(name)
    })
}
