import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    app_language: 'en',
    set_tool_tip: vi.fn(),
    on: vi.fn(),
    set_context_menu: vi.fn(),
    destroy: vi.fn(),
    do_restart: vi.fn(),
}))

vi.mock('electron', () => ({
    app: {
        getAppPath: () => process.cwd(),
        relaunch: vi.fn(),
        exit: vi.fn(),
        quit: vi.fn(),
    },
    Tray: vi.fn().mockImplementation(function () {
        return {
            setToolTip: mocks.set_tool_tip,
            on: mocks.on,
            setContextMenu: mocks.set_context_menu,
            getBounds: () => ({ x: 0, y: 0, width: 16, height: 16 }),
            destroy: mocks.destroy,
        }
    }),
    Menu: { buildFromTemplate: vi.fn((template: unknown) => template) },
    nativeImage: { createFromPath: vi.fn(() => ({ resize: vi.fn(() => ({})) })) },
    screen: { getDisplayNearestPoint: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })) },
    shell: { openPath: vi.fn() },
}))

vi.mock('../../electron/config/store', () => ({
    getConfig: vi.fn(() => mocks.app_language),
    setConfig: vi.fn(),
    getUserDataDir: vi.fn(() => process.cwd()),
}))

vi.mock('../../electron/clipboard', () => ({
    startClipboardMonitor: vi.fn(),
    stopClipboardMonitor: vi.fn(),
    isClipboardMonitoring: vi.fn(() => false),
}))

vi.mock('../../electron/screenshot', () => ({
    start_screenshot_capture: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('../../electron/updater', () => ({
    checkForUpdate: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../electron/log', () => ({
    getLogDir: vi.fn(() => process.cwd()),
    log: { scope: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })) },
}))

vi.mock('../../electron/tray/restart', () => ({
    do_restart: mocks.do_restart,
}))

import { createTray, destroyTray, get_tray_menu_labels, rebuildMenu, trigger_tray_action } from '../../electron/tray'
import { app } from 'electron'

describe('tray visible strings', () => {
    beforeEach(() => {
        Object.defineProperty(process, 'resourcesPath', { value: process.cwd(), configurable: true })
        mocks.app_language = 'en'
        vi.clearAllMocks()
        destroyTray()
    })

    it('uses Omni Pot as the tray tooltip', () => {
        createTray()

        expect(mocks.set_tool_tip).toHaveBeenCalledWith('Omni Pot')
        expect(mocks.set_tool_tip).not.toHaveBeenCalledWith('Pot Desktop')
    })

    it('keeps English menu labels free of legacy product names', () => {
        rebuildMenu()

        expect(get_tray_menu_labels()).toEqual([
            'Translate',
            'Dictionary',
            'Text Recognize',
            'Screenshot Translate',
            'Clipboard Monitor',
            'Settings',
            'Check Updates',
            'View Logs',
            'Restart',
            'Quit',
        ])
        expect(get_tray_menu_labels()).not.toContain('Pot Desktop')
    })

    it('keeps Chinese menu labels free of legacy product names', () => {
        mocks.app_language = 'zh_cn'
        rebuildMenu()

        expect(get_tray_menu_labels()).toEqual([
            '翻译',
            '词典',
            '文字识别',
            '截图翻译',
            '剪贴板监听',
            '设置',
            '检查更新',
            '查看日志',
            '重启',
            '退出',
        ])
        expect(get_tray_menu_labels()).not.toContain('Pot Desktop')
    })
})

describe('tray restart action', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('delegates to do_restart on restart action', () => {
        trigger_tray_action('restart')

        expect(mocks.do_restart).toHaveBeenCalledOnce()
    })
})
