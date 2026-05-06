import { BrowserWindow, screen, app } from 'electron'
import { join } from 'path'
import type { WindowOptions } from './types'
import { WindowLabel } from './types'

export class WindowManager {
  private byLabel = new Map<WindowLabel, BrowserWindow>()
  private labelById = new Map<number, WindowLabel>()

  createWindow(opts: WindowOptions): BrowserWindow {
    console.log('[wm] createWindow:', opts.label, `${opts.width}x${opts.height}`)
    const existing = this.byLabel.get(opts.label)
    if (existing && !existing.isDestroyed()) {
      existing.focus()
      return existing
    }

    const point = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(point)
    const { workArea } = display

    const win = new BrowserWindow({
      width: opts.width,
      height: opts.height,
      minWidth: opts.minWidth,
      minHeight: opts.minHeight,
      resizable: opts.resizable ?? true,
      alwaysOnTop: opts.alwaysOnTop ?? false,
      skipTaskbar: opts.skipTaskbar ?? false,
      show: opts.show ?? true,
      transparent: opts.transparent ?? false,
      frame: opts.frame ?? true,
      focusable: opts.focusable ?? true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    win.webContents.on('console-message', (_event, level, message) => {
      const tag = `[renderer:${opts.label}]`
      if (level === 3) console.error(tag, message)
      else if (level === 2) console.warn(tag, message)
      else console.log(tag, message)
    })

    if (opts.label !== WindowLabel.DAEMON) {
      const x = Math.round(workArea.x + (workArea.width - opts.width) / 2)
      const y = Math.round(workArea.y + (workArea.height - opts.height) / 2)
      win.setPosition(x, y)
    }

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      const url = `${process.env['ELECTRON_RENDERER_URL']}#${opts.label}`
      console.log('[wm] loading URL:', url)
      win.loadURL(url)
      // win.webContents.openDevTools({ mode: 'detach' })
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: opts.label
      })
    }

    win.on('closed', () => {
      console.log('[wm] window closed:', opts.label)
      this.byLabel.delete(opts.label)
      this.labelById.delete(win.id)
    })

    this.byLabel.set(opts.label, win)
    this.labelById.set(win.id, opts.label)
    return win
  }

  getWindow(label: WindowLabel): BrowserWindow | undefined {
    const win = this.byLabel.get(label)
    if (win && !win.isDestroyed()) return win
    return undefined
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
}
