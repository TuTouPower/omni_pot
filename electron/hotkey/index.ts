import { globalShortcut } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { getConfig } from '../config/store'
import type { ConfigKey } from '@shared/types/config'
import { start_screenshot_capture } from '../screenshot'
import { get_translate_window_options } from '../windows/translate_options'
import { get_dict_window_options } from '../windows/dict_options'
import { readSelectedText } from '../selection'
import { log } from '../log'

import type { HotkeyRegisterResult } from '@shared/types/ipc'

const log_hotkey = log.scope('hotkey')

let windowManager: WindowManager | null = null
const registered_hotkeys = new Map<string, string>()
const registered_hotkey_actions = new Map<string, () => void>()
const e2e_system_failure_shortcuts = new Set<string>()

export function setE2eHotkeySystemFailures(shortcuts: string[]): void {
    if (!process.env['OMNI_POT_E2E']) return
    e2e_system_failure_shortcuts.clear()
    for (const shortcut of shortcuts) {
        if (shortcut) e2e_system_failure_shortcuts.add(shortcut)
    }
}

export function setWindowManagerForHotkey(mgr: WindowManager): void {
  windowManager = mgr
}

export function buildHotkeyAction(name: string, mgr: WindowManager): () => void {
  switch (name) {
    case 'translate':
    case 'hotkey_translate':
    case 'hotkey_selection_translate':
    case 'hotkey_input_translate':
      return () => { triggerTranslateEntry(mgr).catch((err: unknown) => { log_hotkey.error(err) }) }
    case 'hotkey_ocr_recognize':
      return () => { start_screenshot_capture(mgr, 'recognize').catch((err: unknown) => { log_hotkey.error(err) }) }
    case 'hotkey_ocr_translate':
      return () => { start_screenshot_capture(mgr, 'translate').catch((err: unknown) => { log_hotkey.error(err) }) }
    case 'hotkey_selection_dictionary':
      return () => { triggerSelectionDictionary(mgr).catch((err: unknown) => { log_hotkey.error(err) }) }
    default:
      return () => {}
  }
}

export async function triggerTranslateEntry(mgr: WindowManager, textOverride?: string): Promise<void> {
    const result = textOverride === undefined
        ? await readSelectedText()
        : { text: textOverride, reason: textOverride.trim() ? undefined : 'empty' }

    mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
    if (!result.text.trim()) {
        log_hotkey.info('translate entry: no text, reason=%s', result.reason ?? 'empty')
        mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:input-translate')
        return
    }

    mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-selection', result.text)
}

async function triggerSelectionDictionary(mgr: WindowManager): Promise<void> {
    const result = await readSelectedText()

    if (!result.text.trim()) {
        log_hotkey.info('selection dictionary: no text, reason=%s', result.reason ?? 'empty')
        mgr.focusOrCreate(WindowLabel.DICT, get_dict_window_options())
        mgr.sendWhenReady(WindowLabel.DICT, 'dict:selection-empty')
        return
    }

    mgr.focusOrCreate(WindowLabel.DICT, get_dict_window_options())
    mgr.sendWhenReady(WindowLabel.DICT, 'dict:lookup', result.text)
}

export function registerHotkey(
    name: string,
    shortcut: string,
    action: () => void
): HotkeyRegisterResult {
    const owner = registered_hotkeys.get(shortcut)
    if (owner && owner !== name) {
        return { success: false, reason: 'conflict' }
    }

    if (owner === name) {
        globalShortcut.unregister(shortcut)
        registered_hotkeys.delete(shortcut)
    } else if (globalShortcut.isRegistered(shortcut)) {
        return { success: false, reason: 'conflict' }
    }

    const success = e2e_system_failure_shortcuts.has(shortcut)
        ? false
        : globalShortcut.register(shortcut, action)
    if (!success) {
        return { success: false, reason: 'system' }
    }

    registered_hotkeys.set(shortcut, name)
    registered_hotkey_actions.set(name, action)
    return { success: true }
}

export function hasRegisteredHotkey(name: string): boolean {
    return registered_hotkey_actions.has(name)
}

export function triggerRegisteredHotkey(name: string): boolean {
    const action = registered_hotkey_actions.get(name)
    if (!action) return false
    action()
    return true
}

export function unregisterHotkey(name: string, shortcut: string): void {
    const owner = registered_hotkeys.get(shortcut)
    if (owner && owner !== name) return
    if (globalShortcut.isRegistered(shortcut)) {
        globalShortcut.unregister(shortcut)
    }
    registered_hotkeys.delete(shortcut)
    if (!Array.from(registered_hotkeys.values()).includes(name)) {
        registered_hotkey_actions.delete(name)
    }
}

export function unregisterAll(): void {
    globalShortcut.unregisterAll()
    registered_hotkeys.clear()
    registered_hotkey_actions.clear()
}

const HOTKEY_KEYS: ConfigKey[] = [
  'hotkey_translate',
  'hotkey_ocr_recognize',
  'hotkey_ocr_translate',
  'hotkey_selection_dictionary'
]

export function registerGlobalShortcutsFromConfig(): void {
  if (!windowManager) return
  for (const name of HOTKEY_KEYS) {
    const value = getConfig(name)
    const shortcut = typeof value === 'string' ? value : ''
    if (!shortcut) continue
    registerHotkey(name, shortcut, buildHotkeyAction(name, windowManager))
  }
}
