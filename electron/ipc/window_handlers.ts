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
  ipcMain.handle('window:setContentSize', (event, width: number, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const [min_w = 0, min_h = 0] = win.getMinimumSize()
    const [max_w = 0, max_h = 0] = win.getMaximumSize()
    const w = Math.max(min_w, max_w > 0 ? Math.min(max_w, Math.round(width)) : Math.round(width))
    const h = Math.max(min_h, max_h > 0 ? Math.min(max_h, Math.round(height)) : Math.round(height))
    win.setContentSize(w, h)
  })
  ipcMain.handle('window:setContentHeight', (event, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const bounds = win.getBounds()
    const [current_w = bounds.width, current_h = bounds.height] = win.getContentSize()
    const [, min_h = 0] = win.getMinimumSize()
    const [, max_h = 0] = win.getMaximumSize()
    const h = Math.max(min_h, max_h > 0 ? Math.min(max_h, Math.round(height)) : Math.round(height))
    if (Math.abs(current_h - h) <= 1) return
    win.setContentSize(current_w, h)
  })
  ipcMain.handle('window:getLabel', (event): string => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return ''
    return manager.getLabelById(win.id) ?? ''
  })
  ipcMain.handle('window:openConfig', (_event, section?: string) => {
    manager.focusOrCreate(WindowLabel.CONFIG, {
      label: WindowLabel.CONFIG,
      width: 720,
      height: 740
    })
    if (section) {
      manager.sendWhenReady(WindowLabel.CONFIG, 'config:navigate', section)
    }
  })
}
