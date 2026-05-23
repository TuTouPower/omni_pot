import { ipcMain, app } from 'electron'
import type { ConfigKey } from '@shared/types/config'
import { getConfig, setConfig, getAllConfig, getUserDataDir } from '../config/store'
import { rebuildMenu } from '../tray'

function apply_auto_start(enabled: boolean): void {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: enabled })
  } else if (process.platform === 'linux') {
    // Linux autostart is handled via .desktop file — out of scope for now
  }
}

export function registerConfigHandlers(): void {
  ipcMain.handle('config:get', (_event, key: ConfigKey) => getConfig(key))
  ipcMain.handle('config:set', (_event, key: ConfigKey, value: unknown) => {
    setConfig(key, value)
    if (key === 'app_language') {
      rebuildMenu()
    }
    if (key === 'auto_start' && !process.env['OMNI_POT_E2E']) {
      apply_auto_start(value as boolean)
    }
  })
  ipcMain.handle('config:getAll', () => getAllConfig())
  ipcMain.handle('config:getUserDir', () => getUserDataDir())

  // Apply auto_start on startup
  if (getConfig('auto_start') && !process.env['OMNI_POT_E2E']) {
    apply_auto_start(true)
  }
}
