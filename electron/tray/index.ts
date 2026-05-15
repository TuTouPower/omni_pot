import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { WindowLabel } from '../windows/types'
import type { WindowManager } from '../windows/manager'
import {
    startClipboardMonitor,
    stopClipboardMonitor,
    isClipboardMonitoring
} from '../clipboard'
import { getConfig, setConfig } from '../config/store'
import { get_translate_window_options } from '../windows/translate_options'

let tray: Tray | null = null
let windowManager: WindowManager | null = null

export function setWindowManagerForTray(mgr: WindowManager): void {
  windowManager = mgr
}

function resolveIconPath(): string {
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(process.resourcesPath ?? '', 'icon.png'),
    join(app.getAppPath(), 'resources/icon.png')
  ]
  return candidates.find((p) => p && existsSync(p)) ?? candidates[0]
}

function open_translate_window(): void {
  windowManager?.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
}

function open_config_window(): void {
  windowManager?.focusOrCreate(WindowLabel.CONFIG, {
    label: WindowLabel.CONFIG,
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 400
  })
}

export function trigger_tray_click(): boolean {
  const action = getConfig('tray_click_event') as string
  if (action === 'show_translate') {
    open_translate_window()
    return true
  }
  if (action === 'show_config' || !action) {
    open_config_window()
    return true
  }
  if (action === 'none') {
    return true
  }
  return false
}

export function trigger_tray_action(action: string): boolean {
  switch (action) {
    case 'input_translate':
      open_translate_window()
      return true
    case 'clipboard_monitor':
      if (isClipboardMonitoring()) {
        stopClipboardMonitor()
        setConfig('clipboard_monitor', false)
      } else if (windowManager) {
        startClipboardMonitor(windowManager)
        setConfig('clipboard_monitor', true)
      }
      rebuildMenu()
      return true
    case 'config':
      open_config_window()
      return true
    case 'tray_click':
      return trigger_tray_click()
    default:
      return false
  }
}

export function createTray(): void {
  const iconPath = resolveIconPath()
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Pot Desktop')

  tray.on('click', () => {
    trigger_tray_click()
  })

  rebuildMenu()
}

function rebuildMenu(): void {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Input Translate',
      click: () => {
        trigger_tray_action('input_translate')
      }
    },
    { type: 'separator' },
    {
      label: 'Clipboard Monitor',
      type: 'checkbox',
      checked: isClipboardMonitoring(),
      click: () => {
        trigger_tray_action('clipboard_monitor')
      }
    },
    { type: 'separator' },
    {
      label: 'Config',
      click: () => {
        trigger_tray_action('config')
      }
    },
    { type: 'separator' },
    {
      label: 'Restart',
      click: () => {
        app.relaunch()
        app.exit(0)
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
