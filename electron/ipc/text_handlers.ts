import { ipcMain, clipboard } from 'electron'

export function registerTextHandlers(): void {
  ipcMain.handle('text:getSelection', (): string => clipboard.readText() ?? '')
}
