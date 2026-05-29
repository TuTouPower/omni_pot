import { ipcMain } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { registerHotkey, unregisterHotkey, buildHotkeyAction } from '../hotkey'
import type { HotkeyRegisterResult } from '@shared/types/ipc'
import { assert_sender_label } from './sender_validation'

export function registerHotkeyHandlers(manager: WindowManager): void {
  ipcMain.handle(
    'hotkey:register',
    (event, name: string, shortcut: string): HotkeyRegisterResult => {
      assert_sender_label(manager, event, [WindowLabel.CONFIG], 'hotkey:register')
      if (!shortcut) return { success: false, reason: 'invalid' }
      const action = buildHotkeyAction(name, manager)
      return registerHotkey(name, shortcut, action)
    }
  )

  ipcMain.handle(
    'hotkey:unregister',
    (event, name: string, shortcut: string): void => {
      assert_sender_label(manager, event, [WindowLabel.CONFIG], 'hotkey:unregister')
      if (shortcut) unregisterHotkey(name, shortcut)
    }
  )
}
