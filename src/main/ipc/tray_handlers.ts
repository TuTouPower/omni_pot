import { ipcMain } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { close_tray_popup, is_tray_clipboard_monitoring, is_auto_start, show_tray_popup, show_tray_popup_when_ready, tray_action, tray_labels } from '../tray'
import { assert_sender_label } from './sender_validation'

export function registerTrayHandlers(manager: WindowManager): void {
  ipcMain.handle('tray:show', (event) => { assert_sender_label(manager, event, [WindowLabel.CONFIG], 'tray:show'); return show_tray_popup() })
  ipcMain.handle('tray:close', (event) => { assert_sender_label(manager, event, [WindowLabel.TRAY], 'tray:close'); close_tray_popup(); })
  ipcMain.handle('tray:action', (event, action: string) => {
    assert_sender_label(manager, event, [WindowLabel.TRAY, WindowLabel.WELCOME, WindowLabel.CONFIG], 'tray:action')
    return tray_action(action)
  })
  ipcMain.handle('tray:labels', (event) => { assert_sender_label(manager, event, [WindowLabel.TRAY], 'tray:labels'); return tray_labels() })
  ipcMain.handle('tray:clipboard-monitoring', (event) => {
    assert_sender_label(manager, event, [WindowLabel.TRAY], 'tray:clipboard-monitoring')
    return is_tray_clipboard_monitoring()
  })
  ipcMain.handle('tray:auto-start', (event) => {
    assert_sender_label(manager, event, [WindowLabel.TRAY], 'tray:auto-start')
    return is_auto_start()
  })
  ipcMain.handle('tray:popup-ready', (event, width: number, height: number) => {
    assert_sender_label(manager, event, [WindowLabel.TRAY], 'tray:popup-ready')
    show_tray_popup_when_ready(width, height)
  })
}
