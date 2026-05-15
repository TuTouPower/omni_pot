import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

function makeWindowStub(opts: unknown): Record<string, unknown> {
  const win: Record<string, unknown> = {
    id: Math.floor(Math.random() * 1_000_000),
    webContents: { loadFile: vi.fn(), loadURL: vi.fn(), id: Math.random(), on: vi.fn() },
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    setPosition: vi.fn(),
    setBounds: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    options: opts
  }
  return win
}

vi.mock('electron', () => ({
  BrowserWindow: vi.fn().mockImplementation(makeWindowStub),
  screen: {
    getCursorScreenPoint: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    getDisplayNearestPoint: vi.fn().mockReturnValue({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    })
  },
  app: { isPackaged: true }
}))

import { BrowserWindow } from 'electron'
import { WindowManager } from '../../../electron/windows/manager'
import { WindowLabel } from '../../../electron/windows/types'

describe('WindowManager', () => {
  let manager: WindowManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new WindowManager()
  })

  it('creates a new window', () => {
    manager.createWindow({
      label: WindowLabel.TRANSLATE,
      width: 350,
      height: 420
    })
    expect(BrowserWindow).toHaveBeenCalledTimes(1)
  })

  it('reuses existing window with same label and focuses it', () => {
    const win = manager.createWindow({
      label: WindowLabel.TRANSLATE,
      width: 350,
      height: 420
    })
    vi.mocked(BrowserWindow).mockClear()

    const win2 = manager.createWindow({
      label: WindowLabel.TRANSLATE,
      width: 350,
      height: 420
    })

    expect(BrowserWindow).not.toHaveBeenCalled()
    expect(win2).toBe(win)
    expect((win as unknown as { focus: Mock }).focus).toHaveBeenCalledTimes(1)
  })

  it('looks up label by browser window id', () => {
    const win = manager.createWindow({
      label: WindowLabel.CONFIG,
      width: 800,
      height: 600
    })
    expect(manager.getLabelById((win as unknown as { id: number }).id)).toBe(WindowLabel.CONFIG)
  })

  it('removes mapping when window closes', () => {
    const win = manager.createWindow({
      label: WindowLabel.TRANSLATE,
      width: 350,
      height: 420
    }) as unknown as { on: Mock }
    const closedHandler = win.on.mock.calls.find((c) => c[0] === 'closed')?.[1] as () => void
    expect(closedHandler).toBeTypeOf('function')
    closedHandler()
    expect(manager.getWindow(WindowLabel.TRANSLATE)).toBeUndefined()
  })
})
