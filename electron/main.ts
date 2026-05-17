import { app, Menu, session } from 'electron'
import { basename, dirname } from 'path'
import { WindowManager } from './windows/manager'
import { WindowLabel } from './windows/types'
import { attach_translate_resize_persistence, get_translate_window_options } from './windows/translate_options'
import { initConfigStore, isFirstRun, commitFirstRun, getConfig, flush_config, getUserDataDir } from './config/store'
import { initLog, log } from './log'

const log_main = log.scope('main')

log_main.info('starting...')
import { createTray, setWindowManagerForTray } from './tray'
import {
  setWindowManagerForHotkey,
  registerGlobalShortcutsFromConfig,
  unregisterAll
} from './hotkey'
import { registerConfigHandlers } from './ipc/config_handlers'
import { registerWindowHandlers } from './ipc/window_handlers'
import { registerHotkeyHandlers } from './ipc/hotkey_handlers'
import { registerShellHandlers } from './ipc/shell_handlers'
import { registerTextHandlers } from './ipc/text_handlers'
import { registerOcrHandlers } from './ipc/ocr_handlers'
import { registerHistoryHandlers } from './ipc/history_handlers'
import { registerBackupHandlers } from './ipc/backup_handlers'
import { registerDictHandlers } from './ipc/dict_handlers'
import { registerChineseDictHandlers } from './ipc/chinese_dict_handlers'
import { registerDetectHandlers } from './ipc/detect_handlers'
import { get_db_path, set_service_state, reload_db, close_chinese_dict } from './chinese_dict'
import { init_cld3 } from './detect'
import { existsSync, watch, type FSWatcher } from 'fs'
import { spawn } from 'child_process'
import { registerTrayHandlers } from './ipc/tray_handlers'
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
let db_watcher: FSWatcher | null = null

const isE2e = !!process.env['OMNI_POT_E2E']
const gotLock = isE2e || app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    windowManager?.focusOrCreate(WindowLabel.CONFIG, {
      label: WindowLabel.CONFIG,
      width: 880,
      height: 600,
      minWidth: 880,
      minHeight: 400
    })
  })

  app.whenReady().then(() => {
    try {
    // Remove native application menu (File/Edit/Window/Help)
    Menu.setApplicationMenu(null)

    // Security: CSP headers
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (app.isPackaged) {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' http://localhost:* http://127.0.0.1:* https:"]
          }
        })
      } else {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': ["default-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* http://127.0.0.1:*; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http://localhost:* http://127.0.0.1:*; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https:"]
          }
        })
      }
    })

    // Security: limit permission requests
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false)
    })

    log_main.info('initializing config store...')
    initConfigStore()
    initLog(getUserDataDir())
    log_main.info('config store initialized, isFirstRun=%s', isFirstRun())

    log_main.info('creating window manager...')
    const manager = new WindowManager()
    windowManager = manager

    setWindowManagerForTray(manager)
    setWindowManagerForHotkey(manager)

    registerConfigHandlers()
    log_main.info('IPC handlers: config registered')
    registerWindowHandlers(manager)
    registerHotkeyHandlers(manager)
    registerShellHandlers()
    registerTextHandlers()
    registerOcrHandlers(manager)
    registerHistoryHandlers()
    registerBackupHandlers()
    registerDictHandlers()
    registerChineseDictHandlers()
    registerDetectHandlers()
    registerTrayHandlers()
    log_main.info('IPC handlers: all registered')

    // Chinese dict: dev auto-build + state machine
    const dict_db_path = get_db_path()

    function register_db_watch(db_path: string): void {
        let debounce: ReturnType<typeof setTimeout> | null = null
        const db_dir = dirname(db_path)
        const db_file = basename(db_path)
        if (db_watcher) { db_watcher.close(); db_watcher = null }
        try {
            db_watcher = watch(db_dir, { persistent: false }, (_event_type, filename) => {
                if (filename && filename !== db_file) return
                if (debounce) clearTimeout(debounce)
                debounce = setTimeout(() => { reload_db() }, 500)
            })
        } catch (e) {
            log_main.warn('db watch failed: %s', e)
        }
    }

    if (!dict_db_path || !existsSync(dict_db_path)) {
        if (app.isPackaged) {
            set_service_state('failed')
        } else {
            set_service_state('building')
            try {
                const npm_cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
                const build = spawn(npm_cmd, ['run', 'build:chinese-dict'], { cwd: app.getAppPath(), shell: process.platform === 'win32' })
                let build_failed = false
                build.stdout.on('data', (data: Buffer) => { log_main.info('build:chinese-dict: %s', data.toString().trimEnd()) })
                build.stderr.on('data', (data: Buffer) => { log_main.error('build:chinese-dict stderr: %s', data.toString().trimEnd()) })
                build.on('error', (err: Error) => {
                    build_failed = true
                    set_service_state('failed')
                    log_main.error('auto build:chinese-dict failed to start: %s', err)
                })
                build.on('close', (code) => {
                    if (build_failed) return
                    if (code === 0) {
                        set_service_state('ready')
                        reload_db()
                        const new_path = get_db_path()
                        if (new_path) register_db_watch(new_path)
                    } else {
                        set_service_state('failed')
                        log_main.error('auto build:chinese-dict failed with code %d', code)
                    }
                })
            } catch (e) {
                set_service_state('failed')
                log_main.error('auto build:chinese-dict failed to start: %s', e)
            }
        }
    } else {
        set_service_state('ready')
        register_db_watch(dict_db_path)
    }

    // Preload cld3 WASM (non-blocking)
    init_cld3().catch((err: unknown) => { log_main.error('cld3 init failed:', err) })

    log_main.info('creating tray...')
    createTray()
    log_main.info('tray created')

    registerGlobalShortcutsFromConfig()
    log_main.info('global shortcuts registered')

    log_main.info('starting HTTP server...')
    const startHttpServer = async (retries = 5): Promise<void> => {
      for (let i = 0; i < retries; i++) {
        try {
          await startServer(manager)
          log_main.info('HTTP server started')
          return
        } catch (err: unknown) {
          const code = (err as NodeJS.ErrnoException).code
          if (code === 'EADDRINUSE' && i < retries - 1) {
            log_main.info('HTTP server port in use, retrying in 3s (%d/%d)...', i + 1, retries)
            await new Promise(r => setTimeout(r, 3000))
          } else {
            log_main.info('HTTP server failed:', err)
          }
        }
      }
    }
    startHttpServer().catch((err: unknown) => { log_main.error(err) })

    applyProxy()
    log_main.info('proxy applied')

    if (getConfig('clipboard_monitor')) {
      startClipboardMonitor(manager)
    }

    // Daemon window (hidden background worker)
    manager.createWindow({
      label: WindowLabel.DAEMON,
      width: 0,
      height: 0,
      show: false,
      skipTaskbar: true,
      transparent: false,
      frame: false
    })

    // Always open translate window for development
    const tw = manager.createWindow(get_translate_window_options())
    attach_translate_resize_persistence(tw)

    if (isFirstRun()) {
      manager.createWindow({
        label: WindowLabel.CONFIG,
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 400
      })
      commitFirstRun()
    }

    checkForUpdate(manager).catch((err: unknown) => { log_main.error(err) })

    auto_import_if_needed().catch((err: unknown) => {
      log_main.info('CC-CEDICT auto-import failed:', err)
    })
    } catch (err) {
      log_main.error('Init error:', err)
    }
    log_main.info('startup complete')
  }).catch((err: unknown) => { log_main.error(err) })

  // Don't quit - Pot is tray-resident; user quits via tray menu
  app.on('window-all-closed', () => {
    // intentionally empty: keep running in tray
  })

  app.on('will-quit', () => {
    if (db_watcher) { db_watcher.close(); db_watcher = null }
    stopClipboardMonitor()
    stopServer()
    close_history()
    close_dict()
    close_chinese_dict()
    flush_config()
    unregisterAll()
  })
}
