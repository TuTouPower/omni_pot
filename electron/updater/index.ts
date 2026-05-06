import { BrowserWindow } from 'electron'
import type { WindowManager } from '../windows/manager'
import { getConfig } from '../config/store'

export async function checkForUpdate(manager: WindowManager): Promise<void> {
    const enabled = getConfig('check_update')
    if (!enabled) return

    // Stub: In production, use electron-updater with GitHub releases.
    // For now, skip update check in development.
    if (process.env['ELECTRON_RENDERER_URL']) return

    // TODO: Implement with electron-updater when packaging is set up
    // const { autoUpdater } = await import('electron-updater')
    // autoUpdater.checkForUpdatesAndNotify()
}
