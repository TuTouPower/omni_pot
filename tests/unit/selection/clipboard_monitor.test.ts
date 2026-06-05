import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { WindowManager } from '../../../src/main/windows/manager'

// @electron-mock Required: Vitest cannot access real system clipboard or
// BrowserWindow. This mock stubs Electron clipboard.readText to test the
// clipboard monitor's debounce, suppression, and duplicate-detection logic.
// Real clipboard monitor behavior is covered by E2E (updater_and_tray.spec.ts).
let mockClipboardText = 'initial'

const mockFocusOrCreate = vi.fn()
const mockSendWhenReady = vi.fn()
const mockMgr = { focusOrCreate: mockFocusOrCreate, sendWhenReady: mockSendWhenReady } as unknown as WindowManager

vi.mock('electron', () => ({
    clipboard: {
        readText: () => mockClipboardText,
    },
}))

const {
    startClipboardMonitor,
    stopClipboardMonitor,
    pollClipboardMonitorOnce,
    withClipboardMutationSuppressed,
} = await import('../../../src/main/clipboard/index')

describe('clipboard monitor suppression', () => {
    beforeEach(() => {
        mockClipboardText = 'initial'
        mockFocusOrCreate.mockClear()
        mockSendWhenReady.mockClear()
    })

    afterEach(() => {
        stopClipboardMonitor()
        vi.useRealTimers()
    })

    it('changed text triggers translation without suppression', () => {
        startClipboardMonitor(mockMgr)
        mockClipboardText = 'new text'
        pollClipboardMonitorOnce(mockMgr)

        expect(mockFocusOrCreate).toHaveBeenCalled()
        expect(mockSendWhenReady).toHaveBeenCalledWith(
            'translate', 'translate:from-clipboard', 'new text',
        )
    })

    it('during suppression, changed text does NOT trigger translation', async () => {
        startClipboardMonitor(mockMgr)
        mockClipboardText = 'suppressed text'
        await withClipboardMutationSuppressed(() => {
            pollClipboardMonitorOnce(mockMgr)
            return Promise.resolve()
        })

        expect(mockFocusOrCreate).not.toHaveBeenCalled()
        expect(mockSendWhenReady).not.toHaveBeenCalled()

        // The cleanup suppression window still protects immediate follow-up polls.
        mockClipboardText = 'suppressed text'
        pollClipboardMonitorOnce(mockMgr)
        expect(mockFocusOrCreate).not.toHaveBeenCalled()
    })

    it('after suppression expires, different text triggers translation', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(0)

        startClipboardMonitor(mockMgr)

        await withClipboardMutationSuppressed(() => Promise.resolve())
        // finally block: suppressUntil = 0 + 200 = 200

        mockClipboardText = 'post suppression'
        vi.setSystemTime(201)
        pollClipboardMonitorOnce(mockMgr)

        expect(mockFocusOrCreate).toHaveBeenCalled()
        expect(mockSendWhenReady).toHaveBeenCalledWith(
            'translate', 'translate:from-clipboard', 'post suppression',
        )
    })

    it('withClipboardMutationSuppressed returns inner result', async () => {
        const result = await withClipboardMutationSuppressed(() => Promise.resolve(42))
        expect(result).toBe(42)
    })

    it('keeps suppression active until nested mutations finish', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(1000)
        startClipboardMonitor(mockMgr)

        let finish_outer: (() => void) | undefined
        const outer = withClipboardMutationSuppressed(async () => {
            await withClipboardMutationSuppressed(() => Promise.resolve())
            await new Promise<void>((resolve) => { finish_outer = resolve })
        })
        await vi.advanceTimersByTimeAsync(0)

        mockClipboardText = 'nested suppressed text'
        vi.setSystemTime(1300)
        pollClipboardMonitorOnce(mockMgr)
        expect(mockFocusOrCreate).not.toHaveBeenCalled()

        finish_outer?.()
        await outer
        vi.setSystemTime(1499)
        pollClipboardMonitorOnce(mockMgr)
        expect(mockFocusOrCreate).not.toHaveBeenCalled()

        vi.setSystemTime(1500)
        pollClipboardMonitorOnce(mockMgr)
        expect(mockFocusOrCreate).toHaveBeenCalled()
    })

    it('suppression leaves cleanup window when inner function throws', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(5000)

        startClipboardMonitor(mockMgr)

        await expect(
            withClipboardMutationSuppressed(() => Promise.reject(new Error('boom'))),
        ).rejects.toThrow('boom')

        // finally block should have set suppressUntil = 5000 + 200 = 5200
        mockClipboardText = 'synced during suppression'
        vi.setSystemTime(5199)
        pollClipboardMonitorOnce(mockMgr)
        // Polls inside the cleanup window remain suppressed even after an error.
        expect(mockFocusOrCreate).not.toHaveBeenCalled()

        mockClipboardText = 'after throw'
        vi.setSystemTime(5200)
        pollClipboardMonitorOnce(mockMgr)
        expect(mockFocusOrCreate).toHaveBeenCalled()
    })
})
