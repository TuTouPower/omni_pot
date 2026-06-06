import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerWindowHandlers } from '../../../src/main/ipc/window_handlers'
import { WindowLabel } from '../../../src/main/windows/types'

const mocks = vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    fromWebContents: vi.fn(),
}))

vi.mock('electron', () => ({
    app: { getVersion: () => '0.0.0-test' },
    BrowserWindow: { fromWebContents: mocks.fromWebContents },
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            mocks.handlers.set(channel, handler)
        }),
    },
}))

interface FakeManager {
    getLabelById: ReturnType<typeof vi.fn>
    getDictHeightController: ReturnType<typeof vi.fn>
    getTranslateHeightController: ReturnType<typeof vi.fn>
}

function make_manager(label: WindowLabel | undefined): { manager: FakeManager; report: ReturnType<typeof vi.fn> } {
    const report = vi.fn()
    const manager: FakeManager = {
        getLabelById: vi.fn(() => label),
        getDictHeightController: vi.fn(() => ({ report_content_height: report })),
        getTranslateHeightController: vi.fn(() => null),
    }
    return { manager, report }
}

beforeEach(() => {
    mocks.handlers.clear()
    mocks.fromWebContents.mockReset()
})

afterEach(() => { vi.clearAllMocks() })

describe('dict:reportContentHeight handler', () => {
    function invoke(args: { label: WindowLabel | undefined; height: number; win: unknown }): ReturnType<typeof vi.fn> {
        const { manager, report } = make_manager(args.label)
        registerWindowHandlers(manager as never)
        mocks.fromWebContents.mockReturnValue(args.win)
        const handler = mocks.handlers.get('dict:reportContentHeight')
        if (!handler) throw new Error('handler not registered')
        handler({ sender: {} }, args.height)
        return report
    }

    it('routes height to DictHeightController when sender is DICT window', () => {
        const report = invoke({ label: WindowLabel.DICT, height: 500, win: { id: 1 } })
        expect(report).toHaveBeenCalledWith(500)
    })

    it('rejects sender from non-DICT window', () => {
        const report = invoke({ label: WindowLabel.TRANSLATE, height: 500, win: { id: 1 } })
        expect(report).not.toHaveBeenCalled()
    })

    it('rejects NaN height', () => {
        const report = invoke({ label: WindowLabel.DICT, height: Number.NaN, win: { id: 1 } })
        expect(report).not.toHaveBeenCalled()
    })

    it('rejects negative height', () => {
        const report = invoke({ label: WindowLabel.DICT, height: -10, win: { id: 1 } })
        expect(report).not.toHaveBeenCalled()
    })

    it('rejects height above sentinel (100000)', () => {
        const report = invoke({ label: WindowLabel.DICT, height: 200000, win: { id: 1 } })
        expect(report).not.toHaveBeenCalled()
    })

    it('ignores when BrowserWindow.fromWebContents returns null', () => {
        const report = invoke({ label: WindowLabel.DICT, height: 500, win: null })
        expect(report).not.toHaveBeenCalled()
    })
})
