import { globalShortcut } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { getConfig } from '../config/store'
import type { ConfigKey } from '@shared/types/config'

let windowManager: WindowManager | null = null

export function setWindowManagerForHotkey(mgr: WindowManager): void {
  windowManager = mgr
}

const TRANSLATE_OPTS = {
  label: WindowLabel.TRANSLATE,
  width: 350,
  height: 420
} as const

export function buildHotkeyAction(name: string, mgr: WindowManager): () => void {
  switch (name) {
    case 'hotkey_input_translate':
      return () => mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
    case 'hotkey_selection_translate':
      return () => {
        const win = mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
        win.webContents.send('translate:from-selection')
      }
    case 'hotkey_ocr_recognize':
    case 'hotkey_ocr_translate':
      // OCR in P2
      return () => {}
    default:
      return () => {}
  }
}

export function registerHotkey(
  name: string,
  shortcut: string,
  action: () => void
): boolean {
  if (globalShortcut.isRegistered(shortcut)) {
    globalShortcut.unregister(shortcut)
  }
  return globalShortcut.register(shortcut, action)
}

export function unregisterHotkey(shortcut: string): void {
  if (globalShortcut.isRegistered(shortcut)) {
    globalShortcut.unregister(shortcut)
  }
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
}

const HOTKEY_KEYS: ConfigKey[] = [
  'hotkey_selection_translate',
  'hotkey_input_translate',
  'hotkey_ocr_recognize',
  'hotkey_ocr_translate'
]

export function registerGlobalShortcutsFromConfig(): void {
  if (!windowManager) return
  for (const name of HOTKEY_KEYS) {
    const shortcut = String(getConfig(name) ?? '')
    if (!shortcut) continue
    registerHotkey(name, shortcut, buildHotkeyAction(name, windowManager))
  }
}
