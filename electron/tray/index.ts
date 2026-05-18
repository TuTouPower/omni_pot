import { Tray, Menu, nativeImage, app, screen, shell } from 'electron'
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
import { start_screenshot_capture } from '../screenshot'
import { log, getLogDir } from '../log'
import { checkForUpdate } from '../updater'

let tray: Tray | null = null
let windowManager: WindowManager | null = null
let last_tray_menu_labels: string[] = []

const log_tray = log.scope('tray')

type TrayLabelKey = 'input_translate' | 'ocr_recognize' | 'screenshot_translate' | 'clipboard_monitor' | 'config' | 'check_update' | 'view_log' | 'restart' | 'quit'

const TRAY_LABELS: Record<'en' | 'zh_cn', Record<TrayLabelKey, string>> = {
  en: {
    input_translate: 'Translate',
    ocr_recognize: 'Text Recognize',
    screenshot_translate: 'Screenshot Translate',
    clipboard_monitor: 'Clipboard Monitor',
    config: 'Settings',
    check_update: 'Check Updates',
    view_log: 'View Logs',
    restart: 'Restart',
    quit: 'Quit'
  },
  zh_cn: {
    input_translate: '翻译',
    ocr_recognize: '文字识别',
    screenshot_translate: '截图翻译',
    clipboard_monitor: '剪贴板监听',
    config: '设置',
    check_update: '检查更新',
    view_log: '查看日志',
    restart: '重启',
    quit: '退出'
  }
}

function get_tray_labels(): Record<TrayLabelKey, string> {
  return TRAY_LABELS[getConfig('app_language') === 'zh_cn' ? 'zh_cn' : 'en']
}

function tray_labels_to_array(labels: Record<TrayLabelKey, string>): string[] {
  return [labels.input_translate, labels.ocr_recognize, labels.screenshot_translate, labels.clipboard_monitor, labels.config, labels.check_update, labels.view_log, labels.restart, labels.quit]
}

export function get_tray_menu_labels(): string[] {
  return last_tray_menu_labels.length > 0 ? last_tray_menu_labels : tray_labels_to_array(get_tray_labels())
}

export function setWindowManagerForTray(mgr: WindowManager): void {
  windowManager = mgr
}

function resolveIconPath(): string {
  const candidates = [
    join(__dirname, '../../public/logos/logo.png'),
    join(process.resourcesPath, 'logo.png'),
    join(app.getAppPath(), 'public/logos/logo.png')
  ]
  return candidates.find((p) => existsSync(p)) ?? join(__dirname, '../../public/logos/logo.png')
}

function open_translate_window(): void {
  windowManager?.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
}

function open_config_window(): void {
  windowManager?.focusOrCreate(WindowLabel.CONFIG, {
    label: WindowLabel.CONFIG,
    width: 880,
    height: 600,
    minWidth: 880,
    minHeight: 400
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function show_tray_popup(): boolean {
  if (!tray || !windowManager) return false
  const popup = windowManager.focusOrCreate(WindowLabel.TRAY, {
    label: WindowLabel.TRAY,
    width: 260,
    height: 460,
    minWidth: 260,
    minHeight: 460,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    show: false
  })
  const tray_bounds = tray.getBounds()
  const current_bounds = popup.isDestroyed() ? null : popup.getBounds()
  const bounds = current_bounds ?? { width: 260, height: 318 }
  const display = screen.getDisplayNearestPoint({
    x: Math.round(tray_bounds.x + tray_bounds.width / 2),
    y: Math.round(tray_bounds.y + tray_bounds.height / 2)
  })
  const work_area = display.workArea
  const gap = 6
  const below_y = tray_bounds.y + tray_bounds.height + gap
  const above_y = tray_bounds.y - bounds.height - gap
  const fits_below = below_y + bounds.height <= work_area.y + work_area.height
  const preferred_y = fits_below ? below_y : above_y

  popup.setBounds({
    x: Math.round(clamp(tray_bounds.x + tray_bounds.width - bounds.width, work_area.x, work_area.x + work_area.width - bounds.width)),
    y: Math.round(clamp(preferred_y, work_area.y, work_area.y + work_area.height - bounds.height)),
    width: bounds.width,
    height: bounds.height
  })
  if (popup.isVisible()) {
    popup.focus()
  } else {
    popup.once('ready-to-show', () => {
      if (popup.isDestroyed()) return
      popup.show()
      popup.focus()
    })
  }
  return true
}

export function close_tray_popup(): void {
  windowManager?.closeWindow(WindowLabel.TRAY)
}

export function tray_action(action: string): boolean {
  return trigger_tray_action(action)
}

export function tray_labels(): string[] {
  return get_tray_menu_labels()
}

export function is_tray_clipboard_monitoring(): boolean {
  return isClipboardMonitoring()
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
      windowManager?.sendWhenReady(WindowLabel.TRANSLATE, 'translate:input-translate')
      close_tray_popup()
      return true
    case 'ocr_recognize':
      if (!windowManager) return false
      start_screenshot_capture(windowManager, 'recognize').catch((err: unknown) => { log_tray.error(err) })
      return true
    case 'screenshot_translate':
      if (!windowManager) return false
      start_screenshot_capture(windowManager, 'translate').catch((err: unknown) => { log_tray.error(err) })
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
      close_tray_popup()
      return true
    case 'config':
      open_config_window()
      close_tray_popup()
      return true
    case 'check_update':
      if (!windowManager) return false
      checkForUpdate(windowManager, false).catch((err: unknown) => { log_tray.error(err) })
      close_tray_popup()
      return true
    case 'view_log':
      shell.openPath(getLogDir(app.getPath('userData'))).catch((err: unknown) => { log_tray.error(err) })
      close_tray_popup()
      return true
    case 'restart':
      app.relaunch()
      app.exit(0)
      return true
    case 'quit':
      app.quit()
      return true
    case 'tray_click':
      return trigger_tray_click()
    case 'show_tray':
      return show_tray_popup()
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

  tray.on('right-click', () => {
    show_tray_popup()
  })

  // Linux fires no 'right-click' on the tray icon (the OS owns the context
  // menu). Fall back to a native Electron menu so the user can still reach
  // Config / Quit there.
  if (process.platform === 'linux') {
    install_linux_fallback_menu()
  }

  rebuildMenu()
}

function install_linux_fallback_menu(): void {
  if (!tray) return
  const labels = get_tray_labels()
  const menu = Menu.buildFromTemplate([
    { label: labels.input_translate, click: () => { trigger_tray_action('input_translate') } },
    { label: labels.ocr_recognize, click: () => { trigger_tray_action('ocr_recognize') } },
    { label: labels.screenshot_translate, click: () => { trigger_tray_action('screenshot_translate') } },
    {
      label: labels.clipboard_monitor,
      type: 'checkbox',
      checked: isClipboardMonitoring(),
      click: () => { trigger_tray_action('clipboard_monitor') }
    },
    { type: 'separator' },
    { label: labels.config, click: () => { trigger_tray_action('config') } },
    { label: labels.check_update, click: () => { trigger_tray_action('check_update') } },
    { label: labels.view_log, click: () => { trigger_tray_action('view_log') } },
    { type: 'separator' },
    { label: labels.restart, click: () => { trigger_tray_action('restart') } },
    { label: labels.quit, click: () => { trigger_tray_action('quit') } }
  ])
  tray.setContextMenu(menu)
}

export function rebuildMenu(): void {
  const labels = get_tray_labels()
  last_tray_menu_labels = tray_labels_to_array(labels)
  if (process.platform === 'linux' && tray) {
    install_linux_fallback_menu()
  }
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
