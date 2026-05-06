import type { WindowManager } from '../windows/manager'

export function setWindowManagerForHotkey(_mgr: WindowManager): void {}
export function registerGlobalShortcutsFromConfig(): void {}
export function unregisterAll(): void {}
export function registerHotkey(_name: string, _shortcut: string, _action: () => void): boolean {
  return false
}
export function unregisterHotkey(_shortcut: string): void {}
export function buildHotkeyAction(_name: string, _mgr: WindowManager): () => void {
  return () => {}
}
