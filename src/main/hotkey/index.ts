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
      return () => { log_hotkey.info('triggered: %s', name); triggerTranslateEntry(mgr).catch((err: unknown) => { log_hotkey.error(err) }) }
    case 'hotkey_ocr_recognize':
      return () => { log_hotkey.info('triggered: %s', name); start_screenshot_capture(mgr, 'recognize').catch((err: unknown) => { log_hotkey.error(err) }) }
    case 'hotkey_ocr_translate':
      return () => { log_hotkey.info('triggered: %s', name); start_screenshot_capture(mgr, 'translate').catch((err: unknown) => { log_hotkey.error(err) }) }
    case 'hotkey_selection_dictionary':
      return () => { log_hotkey.info('triggered: %s', name); triggerSelectionDictionary(mgr).catch((err: unknown) => { log_hotkey.error(err) }) }
    default:
      return () => {}
  }
}

export async function triggerTranslateEntry(mgr: WindowManager, textOverride?: string): Promise<void> {
    const started_at = Date.now()

    // Show window immediately so the user sees instant feedback.
    mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
    const show_ms = Date.now() - started_at
    mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:selection-pending')

    const result_promise = textOverride === undefined
        ? readSelectedText()
        : Promise.resolve({ text: textOverride, method: 'none' as const, reason: textOverride.trim() ? undefined : 'empty' as const })

    const result = await result_promise

    const total_ms = Date.now() - started_at
    if (!result.text.trim()) {
        log_hotkey.info('translate entry: show_ms=%d total_ms=%d entry=empty reason=%s', show_ms, total_ms, result.reason ?? 'empty')
        mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:input-translate')
        return
    }

    log_hotkey.info('translate entry: show_ms=%d total_ms=%d entry=selection reason=ok', show_ms, total_ms)
    mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-selection', result.text)
}

export async function triggerSelectionDictionary(mgr: WindowManager): Promise<void> {
    const started_at = Date.now()

    // Show window immediately so the user sees instant feedback.
    mgr.focusOrCreate(WindowLabel.DICT, get_dict_window_options())
    const show_ms = Date.now() - started_at

    const result_promise = readSelectedText()

    const result = await result_promise

    const total_ms = Date.now() - started_at
    if (!result.text.trim()) {
        log_hotkey.info('selection dictionary: show_ms=%d total_ms=%d entry=empty reason=%s', show_ms, total_ms, result.reason ?? 'empty')
        mgr.sendWhenReady(WindowLabel.DICT, 'dict:selection-empty')
        return
    }

    log_hotkey.info('selection dictionary: show_ms=%d total_ms=%d entry=selection reason=ok', show_ms, total_ms)
    mgr.sendWhenReady(WindowLabel.DICT, 'dict:lookup', result.text)
}

export function registerHotkey(
    name: string,
    shortcut: string,
    action: () => void
): HotkeyRegisterResult {
    // Unregister old shortcut if this action previously had a different one
    for (const [old_shortcut, old_name] of registered_hotkeys) {
        if (old_name === name && old_shortcut !== shortcut) {
            globalShortcut.unregister(old_shortcut)
            registered_hotkeys.delete(old_shortcut)
            break
        }
    }

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
