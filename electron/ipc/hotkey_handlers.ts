import { ipcMain } from 'electron'
import type { WindowManager } from '../windows/manager'
import { registerHotkey, unregisterHotkey, buildHotkeyAction } from '../hotkey'

export function registerHotkeyHandlers(manager: WindowManager): void {
  ipcMain.handle(
    'hotkey:register',
    (_event, name: string, shortcut: string): boolean => {
      if (!shortcut) return false
      const action = buildHotkeyAction(name, manager)
      return registerHotkey(shortcut, action)
    }
  )

  ipcMain.handle(
    'hotkey:unregister',
    (_event, _name: string, shortcut: string): void => {
      if (shortcut) unregisterHotkey(shortcut)
    }
  )
}
