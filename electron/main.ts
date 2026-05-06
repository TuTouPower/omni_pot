import { app } from 'electron'
import { WindowManager } from './windows/manager'
import { WindowLabel } from './windows/types'
import { initConfigStore, isFirstRun } from './config/store'
import { createTray, setWindowManagerForTray } from './tray'
import {
  setWindowManagerForHotkey,
  registerGlobalShortcutsFromConfig,
  unregisterAll
} from './hotkey'

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

    createTray()
    registerGlobalShortcutsFromConfig()

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

    if (isFirstRun()) {
      windowManager.createWindow({
        label: WindowLabel.CONFIG,
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 400
      })
    }
  })

  // Don't quit - Pot is tray-resident; user quits via tray menu
  app.on('window-all-closed', () => {
    // intentionally empty: keep running in tray
  })

  app.on('will-quit', () => {
    unregisterAll()
  })
}
