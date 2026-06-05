import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger_mock = vi.hoisted(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
}))

vi.mock('electron-log/main', () => ({
    default: {
        scope: vi.fn(() => logger_mock),
    },
}))

vi.mock('electron', () => ({
    BrowserWindow: vi.fn(),
    screen: { getCursorScreenPoint: vi.fn(), getDisplayNearestPoint: vi.fn() },
    app: { getAppPath: vi.fn(), isPackaged: false },
    ipcMain: { on: vi.fn() },
}))

vi.mock('../../../src/main/config/store', () => ({
    getConfig: vi.fn(),
    setConfig: vi.fn(),
}))

import { WindowLabel } from '../../../src/main/windows/types'
import { log_renderer_console_message } from '../../../src/main/windows/manager'

describe('log_renderer_console_message', () => {
    beforeEach(() => {
        logger_mock.error.mockClear()
        logger_mock.warn.mockClear()
        logger_mock.info.mockClear()
    })

    it('forwards renderer errors to the window manager error logger', () => {
        log_renderer_console_message(WindowLabel.TRANSLATE, 3, 'renderer failed')

        expect(logger_mock.error).toHaveBeenCalledWith('[renderer:translate]', 'renderer failed')
    })

    it('forwards renderer warnings to the warning logger', () => {
        log_renderer_console_message(WindowLabel.CONFIG, 2, 'renderer warning')

        expect(logger_mock.warn).toHaveBeenCalledWith('[renderer:config]', 'renderer warning')
    })

    it('forwards other renderer messages to the info logger', () => {
        log_renderer_console_message(WindowLabel.DICT, 1, 'renderer info')

        expect(logger_mock.info).toHaveBeenCalledWith('[renderer:dict]', 'renderer info')
    })
})
