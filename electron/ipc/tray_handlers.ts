import { ipcMain } from 'electron'
import { close_tray_popup, is_tray_clipboard_monitoring, show_tray_popup, tray_action, tray_labels } from '../tray'

export function registerTrayHandlers(): void {
  ipcMain.handle('tray:show', () => show_tray_popup())
  ipcMain.handle('tray:close', () => { close_tray_popup(); })
  ipcMain.handle('tray:action', (_event, action: string) => tray_action(action))
  ipcMain.handle('tray:labels', () => tray_labels())
  ipcMain.handle('tray:clipboard-monitoring', () => is_tray_clipboard_monitoring())
}
