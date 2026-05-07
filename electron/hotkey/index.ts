import { globalShortcut } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { getConfig } from '../config/store'
import type { ConfigKey } from '@shared/types/config'
import { start_screenshot_capture } from '../screenshot'

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
  const toggleOrSend = (channel: string): (() => void) => {
    return () => {
      const existing = mgr.getWindow(WindowLabel.TRANSLATE)
      if (existing && !existing.isDestroyed() && existing.isVisible()) {
        existing.hide()
        return
      }
      const win = mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
      win.webContents.send(channel)
    }
  }

  switch (name) {
    case 'hotkey_input_translate':
      return toggleOrSend('translate:input-translate')
    case 'hotkey_selection_translate':
      return () => { void triggerSelectionTranslate(mgr) }
    case 'hotkey_ocr_recognize':
      return () => { void start_screenshot_capture(mgr, 'recognize') }
    case 'hotkey_ocr_translate':
      return () => { void start_screenshot_capture(mgr, 'translate') }
    default:
      return () => {}
  }
}

async function triggerSelectionTranslate(mgr: WindowManager): Promise<void> {
    const existing = mgr.getWindow(WindowLabel.TRANSLATE)
    if (existing && !existing.isDestroyed() && existing.isVisible()) {
        existing.hide()
        return
    }

    const { readSelectedText } = await import('../selection')
    const result = await readSelectedText()

    if (!result.text.trim()) {
        console.log('[hotkey] selection translate: no text, reason=%s', result.reason ?? 'empty')
        return
    }

    mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
    mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-selection', result.text)
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
