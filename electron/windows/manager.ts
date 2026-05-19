import { BrowserWindow, screen, app, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import type { WindowOptions } from './types'
import { WindowLabel } from './types'
import { getConfig, setConfig } from '../config/store'
import { log } from '../log'

const log_wm = log.scope('wm')

function resolveIconPath(): string {
  const candidates = [
    join(__dirname, '../../public/logos/logo.ico'),
    join(process.resourcesPath, 'logo.ico'),
    join(app.getAppPath(), 'public/logos/logo.ico'),
    join(__dirname, '../../public/logos/logo.png'),
    join(process.resourcesPath, 'logo.png'),
    join(app.getAppPath(), 'public/logos/logo.png')
  ]
  return candidates.find((p) => existsSync(p)) ?? join(__dirname, '../../public/logos/logo.ico')
}

export class WindowManager {
  private byLabel = new Map<WindowLabel, BrowserWindow>()
  private labelById = new Map<number, WindowLabel>()
  private transparentById = new Map<number, boolean>()
  private readyLabels = new Set<WindowLabel>()
  private pendingQueue = new Map<WindowLabel, Array<{ channel: string; args: unknown[] }>>()

  constructor() {
    // Listen for renderer-ready signals
    ipcMain.on('renderer:ready', (_event, label: WindowLabel) => {
      log_wm.info('renderer ready:', label)
      this.readyLabels.add(label)
      // Flush any queued messages
      const queue = this.pendingQueue.get(label)
      if (queue) {
        for (const { channel, args } of queue) {
          const win = this.byLabel.get(label)
          if (win && !win.isDestroyed()) {
            win.webContents.send(channel, ...args)
          }
        }
        this.pendingQueue.delete(label)
      }
    })
  }

  createWindow(opts: WindowOptions): BrowserWindow {
    log_wm.info('createWindow:', opts.label, `${String(opts.width)}x${String(opts.height)}`)
    const existing = this.byLabel.get(opts.label)
    if (existing && !existing.isDestroyed()) {
      existing.focus()
      return existing
    }

    this.readyLabels.delete(opts.label)
    this.pendingQueue.delete(opts.label)

    const point = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(point)
    const { workArea } = display
    const shouldPosition = opts.label !== WindowLabel.DAEMON
    const x = shouldPosition ? Math.round(workArea.x + (workArea.width - opts.width) / 2) : undefined
    const y = shouldPosition ? Math.round(workArea.y + (workArea.height - opts.height) / 2) : undefined

    const use_configured_transparency = opts.label !== WindowLabel.DAEMON && opts.label !== WindowLabel.SCREENSHOT
    const transparent = opts.transparent ?? (use_configured_transparency && Boolean(getConfig('transparent')))

    const win = new BrowserWindow({
      ...(shouldPosition ? { x, y } : {}),
      width: opts.width,
      height: opts.height,
      minWidth: opts.minWidth,
      minHeight: opts.minHeight,
      maxHeight: opts.maxHeight,
      resizable: opts.resizable ?? true,
      alwaysOnTop: opts.alwaysOnTop ?? false,
      skipTaskbar: opts.skipTaskbar ?? false,
      show: opts.show ?? true,
      transparent,
      frame: opts.frame ?? false,
      focusable: opts.focusable ?? true,
      icon: resolveIconPath(),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        disableBlinkFeatures: 'Auxclick'
      }
    })

    if (opts.label === WindowLabel.TRANSLATE) {
      win.setSize(opts.width, opts.height)
    }

    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

    win.webContents.on('will-navigate', (event, url) => {
      // Block all navigation to external URLs; app uses hash-based routing
      const allowed = url.startsWith('file:') || url.startsWith('devtools:')
      if (!allowed) {
        log_wm.warn('blocked navigation:', url)
        event.preventDefault()
      }
    })

    win.on('blur', () => {
      if (opts.label === WindowLabel.TRAY) {
        win.close()
        return
      }
      // Settings window never auto-closes on blur
      if (opts.label === WindowLabel.CONFIG) return
      // Other windows auto-close unless pinned / always-on-top
      const pinned = win.isAlwaysOnTop()
        || (opts.label === WindowLabel.TRANSLATE && getConfig('translate_pinned'))
      if (!pinned) {
        win.close()
      }
    })

    win.webContents.on('console-message', (_event, level, message) => {
      const tag = `[renderer:${opts.label}]`
      if (level === 3) log_wm.error(tag, message)
      else if (level === 2) log_wm.warn(tag, message)
      else log_wm.info(tag, message)
    })

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      const url = `${process.env['ELECTRON_RENDERER_URL']}#${opts.label}`
      log_wm.info('loading URL:', url)
      win.loadURL(url).catch((err: unknown) => { log_wm.error(err) })
      // win.webContents.openDevTools({ mode: 'detach' })
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: opts.label
      }).catch((err: unknown) => { log_wm.error(err) })
    }

    win.on('closed', () => {
      log_wm.info('window closed:', opts.label)
      this.byLabel.delete(opts.label)
      this.labelById.delete(win.id)
      this.transparentById.delete(win.id)
      this.readyLabels.delete(opts.label)
      this.pendingQueue.delete(opts.label)

      // Reset per-window pin/topmost state so next open starts fresh
      if (opts.label === WindowLabel.TRANSLATE) {
        setConfig('translate_pinned', false)
        setConfig('translate_always_on_top', false)
      }
      if (opts.label === WindowLabel.DICT) {
        setConfig('dict_always_on_top', false)
      }
      if (opts.label === WindowLabel.RECOGNIZE) {
        setConfig('recognize_always_on_top', false)
      }
    })

    this.byLabel.set(opts.label, win)
    this.labelById.set(win.id, opts.label)
    this.transparentById.set(win.id, transparent)
    return win
  }

  getWindow(label: WindowLabel): BrowserWindow | undefined {
    const win = this.byLabel.get(label)
    if (win && !win.isDestroyed()) return win
    return undefined
  }

  isTransparent(label: WindowLabel): boolean {
    const win = this.getWindow(label)
    return win ? this.transparentById.get(win.id) ?? false : false
  }

  getLabelById(id: number): WindowLabel | undefined {
    return this.labelById.get(id)
  }

  focusOrCreate(label: WindowLabel, opts: WindowOptions): BrowserWindow {
    const existing = this.getWindow(label)
    if (existing) {
      existing.focus()
      return existing
    }
    return this.createWindow(opts)
  }

  closeWindow(label: WindowLabel): void {
    const win = this.getWindow(label)
    if (win) win.close()
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.byLabel.values()).filter((w) => !w.isDestroyed())
  }

  /** Send IPC to a window, waiting for renderer to be ready if needed. */
  sendWhenReady(label: WindowLabel, channel: string, ...args: unknown[]): void {
    const win = this.getWindow(label)
    if (!win) return

    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', () => {
        // After page loads, check if renderer has signaled ready
        if (this.readyLabels.has(label)) {
          win.webContents.send(channel, ...args)
        } else {
          // Queue until renderer signals ready
          const queue = this.pendingQueue.get(label) ?? []
          queue.push({ channel, args })
          this.pendingQueue.set(label, queue)
        }
      })
    } else if (this.readyLabels.has(label)) {
      win.webContents.send(channel, ...args)
    } else {
      // Page loaded but renderer not ready — queue
      log_wm.info('sendWhenReady: queuing %s for %s (renderer not ready)', channel, label)
      const queue = this.pendingQueue.get(label) ?? []
      queue.push({ channel, args })
      this.pendingQueue.set(label, queue)
    }
  }
}
