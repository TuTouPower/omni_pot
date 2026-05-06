import type { BrowserWindow } from 'electron'
import type { WindowLabel, WindowOptions } from './types'

export class WindowManager {
  createWindow(_opts: WindowOptions): BrowserWindow {
    throw new Error('stub')
  }
  getWindow(_label: WindowLabel): BrowserWindow | undefined {
    return undefined
  }
  focusOrCreate(_label: WindowLabel, opts: WindowOptions): BrowserWindow {
    return this.createWindow(opts)
  }
  closeWindow(_label: WindowLabel): void {}
  getLabelById(_id: number): WindowLabel | undefined {
    return undefined
  }
  getAllWindows(): BrowserWindow[] {
    return []
  }
}
