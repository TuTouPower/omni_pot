import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// @electron-mock Required: Vitest is not a real Electron runtime.
// This mock stubs BrowserWindow, screen, and app to test WindowManager's
// window lifecycle (create, focus, reuse, close, position) logic.
// Real window behavior is covered by E2E (app_lifecycle.spec.ts,
// updater_and_tray.spec.ts window-state assertions).
const window_stubs: Record<string, unknown>[] = []

function makeWindowStub(opts: unknown): Record<string, unknown> {
  const webContents: Record<string, unknown> = {
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    id: Math.random(),
    on: vi.fn(),
    send: vi.fn(),
    setWindowOpenHandler: vi.fn(),
  }
  const win: Record<string, unknown> = {
    id: Math.floor(Math.random() * 1_000_000),
    webContents,
    loadFile: vi.fn().mockResolvedValue(undefined),
    loadURL: vi.fn().mockResolvedValue(undefined),
    show: vi.fn(),
    focus: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    setPosition: vi.fn(),
    setBounds: vi.fn(),
    setSize: vi.fn(),
    getSize: vi.fn().mockReturnValue([350, 420]),
    getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 350, height: 420 }),
    setMinimumSize: vi.fn(),
    setMaximumSize: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    isAlwaysOnTop: vi.fn().mockReturnValue(false),
    isDestroyed: vi.fn().mockReturnValue(false),
    listenerCount: vi.fn().mockReturnValue(0),
    options: opts
  }
  window_stubs.push(win)
  return win
}

vi.mock('electron', () => ({
  BrowserWindow: Object.assign(vi.fn().mockImplementation(makeWindowStub), {
    getAllWindows: vi.fn().mockReturnValue([]),
    fromWebContents: vi.fn((webContents: unknown) => window_stubs.find((win) => win.webContents === webContents)),
  }),
  ipcMain: { on: vi.fn() },
  screen: {
    getCursorScreenPoint: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    getDisplayNearestPoint: vi.fn().mockReturnValue({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    }),
    getDisplayMatching: vi.fn().mockReturnValue({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    }),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  app: { isPackaged: true, getAppPath: vi.fn().mockReturnValue('/mock/app'), on: vi.fn() }
}))

vi.mock('../../src/main/log', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    scope: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}))

vi.mock('../../src/main/windows/translate_height_controller', () => ({
  TranslateHeightController: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
}))

import { BrowserWindow, ipcMain } from 'electron'
import { WindowManager } from '../../../src/main/windows/manager'
import { WindowLabel } from '../../../src/main/windows/types'

describe('WindowManager', () => {
  let manager: WindowManager

  beforeEach(() => {
    window_stubs.length = 0
    vi.clearAllMocks()
    process.resourcesPath = '/mock/resources'
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

  it('uses the real sender window label for renderer ready', () => {
    const translate = manager.createWindow({
      label: WindowLabel.TRANSLATE,
      width: 350,
      height: 420
    }) as unknown as { webContents: { send: Mock; isLoading: Mock; once: Mock } }
    translate.webContents.isLoading = vi.fn().mockReturnValue(false)
    const ipc_main = ipcMain as unknown as { on: Mock }
    const ready_handler = ipc_main.on.mock.calls.find((call) => call[0] === 'renderer:ready')?.[1] as (event: unknown, label: WindowLabel) => void

    manager.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-selection', 'queued')
    ready_handler({ sender: translate.webContents }, WindowLabel.CONFIG)

    expect(translate.webContents.send).toHaveBeenCalledWith('translate:from-selection', 'queued')
  })
})
