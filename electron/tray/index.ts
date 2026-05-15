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
let last_tray_menu_labels: string[] = []

type TrayLabelKey = 'input_translate' | 'clipboard_monitor' | 'config' | 'restart' | 'quit'

const TRAY_LABELS: Record<'en' | 'zh_cn', Record<TrayLabelKey, string>> = {
  en: {
    input_translate: 'Input Translate',
    clipboard_monitor: 'Clipboard Monitor',
    config: 'Config',
    restart: 'Restart',
    quit: 'Quit'
  },
  zh_cn: {
    input_translate: '输入翻译',
    clipboard_monitor: '剪贴板监听',
    config: '配置',
    restart: '重启',
    quit: '退出'
  }
}

function get_tray_labels(): Record<TrayLabelKey, string> {
  return TRAY_LABELS[getConfig('app_language') === 'zh_cn' ? 'zh_cn' : 'en']
}

function tray_labels_to_array(labels: Record<TrayLabelKey, string>): string[] {
  return [labels.input_translate, labels.clipboard_monitor, labels.config, labels.restart, labels.quit]
}

export function get_tray_menu_labels(): string[] {
  return last_tray_menu_labels.length > 0 ? last_tray_menu_labels : tray_labels_to_array(get_tray_labels())
}

export function setWindowManagerForTray(mgr: WindowManager): void {
  windowManager = mgr
}

function resolveIconPath(): string {
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(process.resourcesPath, 'icon.png'),
    join(app.getAppPath(), 'resources/icon.png')
  ]
  return candidates.find((p) => existsSync(p)) ?? join(__dirname, '../../resources/icon.png')
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

export function rebuildMenu(): void {
  if (!tray) return
  const labels = get_tray_labels()

  const contextMenu = Menu.buildFromTemplate([
    {
      label: labels.input_translate,
      click: () => {
        trigger_tray_action('input_translate')
      }
    },
    { type: 'separator' },
    {
      label: labels.clipboard_monitor,
      type: 'checkbox',
      checked: isClipboardMonitoring(),
      click: () => {
        trigger_tray_action('clipboard_monitor')
      }
    },
    { type: 'separator' },
    {
      label: labels.config,
      click: () => {
        trigger_tray_action('config')
      }
    },
    { type: 'separator' },
    {
      label: labels.restart,
      click: () => {
        app.relaunch()
        app.exit(0)
      }
    },
    {
      label: labels.quit,
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  last_tray_menu_labels = tray_labels_to_array(labels)
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
