import { ipcMain } from 'electron'
import type { WindowManager } from '../windows/manager'
import { registerHotkey, unregisterHotkey, buildHotkeyAction } from '../hotkey'
import type { HotkeyRegisterResult } from '@shared/types/ipc'

export function registerHotkeyHandlers(manager: WindowManager): void {
  ipcMain.handle(
    'hotkey:register',
    (_event, name: string, shortcut: string): HotkeyRegisterResult => {
      if (!shortcut) return { success: false, reason: 'invalid' }
      const action = buildHotkeyAction(name, manager)
      return registerHotkey(name, shortcut, action)
    }
  )

  ipcMain.handle(
    'hotkey:unregister',
    (_event, name: string, shortcut: string): void => {
      if (shortcut) unregisterHotkey(name, shortcut)
    }
  )
}
