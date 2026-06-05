import { ipcMain, dialog, type IpcMainInvokeEvent } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { assert_sender_label } from './sender_validation'
import {
    create_local_backup,
    list_local_backups,
    list_local_backups_with_size,
    restore_local_backup,
    restore_from_zip_path,
    delete_local_backup,
    get_backup_path
} from '../backup'

export function registerBackupHandlers(manager: WindowManager): void {
    const assert_config_sender = (event: IpcMainInvokeEvent, channel: string): void => {
        assert_sender_label(manager, event, [WindowLabel.CONFIG], channel)
    }

    ipcMain.handle('backup:create', (event) => {
        assert_config_sender(event, 'backup:create')
        try {
            const path = create_local_backup()
            return { success: true, path }
        } catch (err) {
            return { success: false, error: String(err) }
        }
    })

    ipcMain.handle('backup:list', (event) => {
        assert_config_sender(event, 'backup:list')
        return list_local_backups()
    })

    ipcMain.handle('backup:restore', (event, name: string) => {
        assert_config_sender(event, 'backup:restore')
        try {
            restore_local_backup(name)
            return { success: true }
        } catch (err) {
            return { success: false, error: String(err) }
        }
    })

    ipcMain.handle('backup:import', async (event) => {
        assert_config_sender(event, 'backup:import')
        const result = await dialog.showOpenDialog({
            title: '导入备份',
            filters: [{ name: 'ZIP 文件', extensions: ['zip'] }],
            properties: ['openFile'],
        })
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: 'cancelled' }
        }
        const backup_path = result.filePaths[0]
        if (!backup_path) {
            return { success: false, error: 'cancelled' }
        }
        try {
            const restored = restore_from_zip_path(backup_path)
            return { success: true, restored_files: restored.restored_files }
        } catch (err) {
            return { success: false, error: String(err) }
        }
    })

    ipcMain.handle('backup:list-with-size', (event) => {
        assert_config_sender(event, 'backup:list-with-size')
        return list_local_backups_with_size()
    })

    ipcMain.handle('backup:delete', (event, name: string) => {
        assert_config_sender(event, 'backup:delete')
        try {
            delete_local_backup(name)
            return { success: true }
        } catch (err) {
            return { success: false, error: String(err) }
        }
    })

    ipcMain.handle('backup:get-path', (event, name: string) => {
        assert_config_sender(event, 'backup:get-path')
        return get_backup_path(name)
    })
}
