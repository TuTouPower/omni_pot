import { app, Menu, session } from 'electron'
import { basename, dirname } from 'path'
import { WindowManager } from './windows/manager'
import { WindowLabel } from './windows/types'
import { get_welcome_window_options } from './windows/welcome_options'
import { get_translate_window_options } from './windows/translate_options'
import { get_dict_window_options } from './windows/dict_options'
import { get_recognize_window_options } from './windows/recognize_options'
import { initConfigStore, isFirstRun, commitFirstRun, getConfig, flush_config, getUserDataDir, onConfigChanged } from './config/store'
import { initLog, log } from './log'

const log_main = log.scope('main')

app.name = 'omni_pot'
log_main.info('starting..., pid=%d, argv=%j', process.pid, process.argv)
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
import { registerChineseDictionaryHandlers } from './ipc/chinese_dictionary_handlers'
import { registerDictHandlers } from './ipc/dict_handlers'
import { registerDetectHandlers } from './ipc/detect_handlers'
import { get_db_path, set_service_state, reload_db, close_chinese_dictionary } from './chinese_dictionary'
import { close_dict } from './dict'
import { init_cld3 } from './detect'
import { existsSync, watch, type FSWatcher } from 'fs'
import { spawn } from 'child_process'
import { registerTrayHandlers } from './ipc/tray_handlers'
import { close_history } from './history'
import { checkForUpdate, registerUpdateHandlers } from './updater'
import { startServer, stopServer } from './server'
import { preload_screenshot_window } from './screenshot'
import {
  startClipboardMonitor,
  stopClipboardMonitor
} from './clipboard'
import { prepareSelectedTextReader } from './selection'
import { build_csp_policy } from './csp_policy'

let windowManager: WindowManager | undefined
let db_watcher: FSWatcher | null = null

const isE2e = !!process.env['OMNI_POT_E2E']
const gotLock = isE2e || app.requestSingleInstanceLock()
log_main.info('single instance lock: got=%s, isE2e=%s', gotLock, isE2e)
if (!gotLock) {
  log_main.info('another instance already running, quitting')
  app.quit()
} else {
  app.on('second-instance', () => {
    windowManager?.focusOrCreate(WindowLabel.CONFIG, {
      label: WindowLabel.CONFIG,
      width: 720,
      height: 740
    })
  })

  app.whenReady().then(async () => {
    try {
    // Remove native application menu (File/Edit/Window/Help)
    Menu.setApplicationMenu(null)

    // Security: CSP headers
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [build_csp_policy(app.isPackaged)]
        }
      })
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
    preload_screenshot_window(manager)

    onConfigChanged((key) => {
        if (key === 'transparent') manager.rebuildAllForTransparencyChange()
    })

    setWindowManagerForTray(manager)
    setWindowManagerForHotkey(manager)

    registerConfigHandlers(manager)
    log_main.info('IPC handlers: config registered')
    registerWindowHandlers(manager)
    registerHotkeyHandlers(manager)
    registerShellHandlers(manager)
    registerTextHandlers(manager)
    registerOcrHandlers(manager)
    registerHistoryHandlers(manager)
    registerBackupHandlers(manager)
    registerChineseDictionaryHandlers(manager)
    registerDictHandlers(manager)
    registerDetectHandlers(manager)
    registerUpdateHandlers(manager)
    registerTrayHandlers(manager)
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
                const build = spawn(npm_cmd, ['run', 'build:chinese-dictionary'], { cwd: app.getAppPath(), shell: process.platform === 'win32' })
                let build_failed = false
                build.stdout.on('data', (data: Buffer) => { log_main.info('build:chinese-dictionary: %s', data.toString().trimEnd()) })
                build.stderr.on('data', (data: Buffer) => { log_main.error('build:chinese-dictionary stderr: %s', data.toString().trimEnd()) })
                build.on('error', (err: Error) => {
                    build_failed = true
                    set_service_state('failed')
                    log_main.error('auto build:chinese-dictionary failed to start: %s', err)
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
                        log_main.error('auto build:chinese-dictionary failed with code %d', code)
                    }
                })
            } catch (e) {
                set_service_state('failed')
                log_main.error('auto build:chinese-dictionary failed to start: %s', e)
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

    await prepareSelectedTextReader()
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

    // Pre-create translate/dict/recognize windows for instant first trigger
    manager.preloadWindow(get_translate_window_options())
    manager.preloadWindow(get_dict_window_options())
    manager.preloadWindow(get_recognize_window_options())
    log_main.info('preloaded translate/dict/recognize windows')

    if (!getConfig('welcome_dismissed')) {
      manager.createWindow(get_welcome_window_options())
    }

    if (isFirstRun()) {
      commitFirstRun()
    }

    checkForUpdate(manager).catch((err: unknown) => { log_main.error(err) })
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
    close_chinese_dictionary()
    close_dict()
    flush_config()
    unregisterAll()
  })
}
