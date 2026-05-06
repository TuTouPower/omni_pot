import { ipcMain } from 'electron'
import type { ConfigKey } from '@shared/types/config'
import { getConfig, setConfig, getAllConfig } from '../config/store'

export function registerConfigHandlers(): void {
  ipcMain.handle('config:get', (_event, key: ConfigKey) => getConfig(key))
  ipcMain.handle('config:set', (_event, key: ConfigKey, value: unknown) => setConfig(key, value))
  ipcMain.handle('config:getAll', () => getAllConfig())
}
