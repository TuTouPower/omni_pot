import { app } from 'electron'
import { WindowManager } from './windows/manager'
import { WindowLabel } from './windows/types'
import { initConfigStore, isFirstRun, commitFirstRun, getConfig } from './config/store'
import { createTray, setWindowManagerForTray } from './tray'
import {
  setWindowManagerForHotkey,
  registerGlobalShortcutsFromConfig,
  unregisterAll
} from './hotkey'
import { registerConfigHandlers } from './ipc/config_handlers'
import { registerWindowHandlers } from './ipc/window_handlers'
import { registerHotkeyHandlers } from './ipc/hotkey_handlers'
import { registerTextHandlers } from './ipc/text_handlers'
import { registerOcrHandlers } from './ipc/ocr_handlers'
import { startServer, stopServer } from './server'
import { applyProxy } from './proxy'
import { checkForUpdate } from './updater'
import {
  startClipboardMonitor,
  stopClipboardMonitor
} from './clipboard'

let windowManager: WindowManager | undefined

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    windowManager?.focusOrCreate(WindowLabel.CONFIG, {
      label: WindowLabel.CONFIG,
      width: 800,
      height: 600,
      minWidth: 800,
      minHeight: 400
    })
  })

  app.whenReady().then(() => {
    initConfigStore()

    windowManager = new WindowManager()

    setWindowManagerForTray(windowManager)
    setWindowManagerForHotkey(windowManager)

    registerConfigHandlers()
    registerWindowHandlers(windowManager)
    registerHotkeyHandlers(windowManager)
    registerTextHandlers()
    registerOcrHandlers(windowManager)

    createTray()
    registerGlobalShortcutsFromConfig()

    startServer(windowManager)
    applyProxy()

    if (getConfig('clipboard_monitor')) {
      startClipboardMonitor(windowManager)
    }

    // Daemon window (hidden background worker)
    windowManager.createWindow({
      label: WindowLabel.DAEMON,
      width: 0,
      height: 0,
      show: false,
      skipTaskbar: true,
      transparent: false,
      frame: false
    })

    // Always open config window for development
    windowManager.createWindow({
      label: WindowLabel.TRANSLATE,
      width: 350,
      height: 420
    })

    if (isFirstRun()) {
      windowManager.createWindow({
        label: WindowLabel.CONFIG,
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 400
      })
      commitFirstRun()
    }

    checkForUpdate(windowManager)
  })

  // Don't quit - Pot is tray-resident; user quits via tray menu
  app.on('window-all-closed', () => {
    // intentionally empty: keep running in tray
  })

  app.on('will-quit', () => {
    stopClipboardMonitor()
    stopServer()
    unregisterAll()
  })
}
