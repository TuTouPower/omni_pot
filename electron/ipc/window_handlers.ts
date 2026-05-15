import { ipcMain, BrowserWindow } from 'electron'
import type { WindowManager } from '../windows/manager'

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
}
