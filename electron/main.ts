import { app } from 'electron'
import { WindowManager } from './windows/manager'
import { WindowLabel } from './windows/types'
import { initConfigStore, isFirstRun, commitFirstRun, getConfig, setConfig } from './config/store'

const debug = (...args: unknown[]) => console.log('[main]', ...args)

debug('starting...')
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
import { registerHistoryHandlers } from './ipc/history_handlers'
import { registerBackupHandlers } from './ipc/backup_handlers'
import { registerDictHandlers } from './ipc/dict_handlers'
import { close_history } from './history'
import { close_dict, auto_import_if_needed } from './dict'
import { startServer, stopServer } from './server'
import { applyProxy } from './proxy'
import { checkForUpdate } from './updater'
import {
  startClipboardMonitor,
  stopClipboardMonitor
} from './clipboard'

let windowManager: WindowManager | undefined

const isE2e = !!process.env['OMNI_POT_E2E']
const gotLock = isE2e || app.requestSingleInstanceLock()
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
    try {
    debug('initializing config store...')
    initConfigStore()
    debug('config store initialized, isFirstRun=%s', isFirstRun())

    debug('creating window manager...')
    windowManager = new WindowManager()

    setWindowManagerForTray(windowManager)
    setWindowManagerForHotkey(windowManager)

    registerConfigHandlers()
    debug('IPC handlers: config registered')
    registerWindowHandlers(windowManager)
    registerHotkeyHandlers(windowManager)
    registerTextHandlers()
    registerOcrHandlers(windowManager)
    registerHistoryHandlers()
    registerBackupHandlers()
    registerDictHandlers()
    debug('IPC handlers: all registered')

    debug('creating tray...')
    createTray()
    debug('tray created')

    registerGlobalShortcutsFromConfig()
    debug('global shortcuts registered')

    debug('starting HTTP server...')
    const startHttpServer = async (retries = 5): Promise<void> => {
      for (let i = 0; i < retries; i++) {
        try {
          await startServer(windowManager)
          debug('HTTP server started')
          return
        } catch (err: unknown) {
          const code = (err as NodeJS.ErrnoException).code
          if (code === 'EADDRINUSE' && i < retries - 1) {
            debug('HTTP server port in use, retrying in 3s (%d/%d)...', i + 1, retries)
            await new Promise(r => setTimeout(r, 3000))
          } else {
            debug('HTTP server failed:', err)
          }
        }
      }
    }
    startHttpServer()

    applyProxy()
    debug('proxy applied')

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

    // Always open translate window for development
    const tw = windowManager.createWindow({
      label: WindowLabel.TRANSLATE,
      width: getConfig('translate_remember_window_size') ? (getConfig('translate_window_width') as number) : 350,
      height: getConfig('translate_remember_window_size') ? (getConfig('translate_window_height') as number) : 420
    })
    if (getConfig('translate_remember_window_size')) {
      tw.on('resize', () => {
        const [w, h] = tw.getSize()
        setConfig('translate_window_width', w)
        setConfig('translate_window_height', h)
      })
    }

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

    auto_import_if_needed().catch((err) => {
      debug('CC-CEDICT auto-import failed:', err)
    })
    } catch (err) {
      console.error('[main] Init error:', err)
    }
    debug('startup complete')
  })

  // Don't quit - Pot is tray-resident; user quits via tray menu
  app.on('window-all-closed', () => {
    // intentionally empty: keep running in tray
  })

  app.on('will-quit', () => {
    stopClipboardMonitor()
    stopServer()
    close_history()
    close_dict()
    unregisterAll()
  })
}
