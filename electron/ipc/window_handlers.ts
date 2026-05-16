import { ipcMain, BrowserWindow } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'

export function registerWindowHandlers(manager: WindowManager): void {
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('window:setAlwaysOnTop', (event, flag: boolean) => {
    BrowserWindow.fromWebContents(event.sender)?.setAlwaysOnTop(flag)
  })
  ipcMain.handle('window:getLabel', (event): string => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return ''
    return manager.getLabelById(win.id) ?? ''
  })
  ipcMain.handle('window:openConfig', (_event, section?: string) => {
    manager.focusOrCreate(WindowLabel.CONFIG, {
      label: WindowLabel.CONFIG,
      width: 880,
      height: 600,
      minWidth: 880,
      minHeight: 400
    })
    if (section) {
      manager.sendWhenReady(WindowLabel.CONFIG, 'config:navigate', section)
    }
  })
}
