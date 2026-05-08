import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let mockClipboardText = 'initial'

const mockFocusOrCreate = vi.fn()
const mockSendWhenReady = vi.fn()
const mockMgr = { focusOrCreate: mockFocusOrCreate, sendWhenReady: mockSendWhenReady } as any

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
} = await import('../../../electron/clipboard/index')

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
        await withClipboardMutationSuppressed(async () => {
            pollClipboardMonitorOnce(mockMgr)
        })

        expect(mockFocusOrCreate).not.toHaveBeenCalled()
        expect(mockSendWhenReady).not.toHaveBeenCalled()

        // last_text synced even during suppression — next poll sees same text
        mockClipboardText = 'suppressed text'
        pollClipboardMonitorOnce(mockMgr)
        expect(mockFocusOrCreate).not.toHaveBeenCalled()
    })

    it('after suppression expires, different text triggers translation', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(0)

        startClipboardMonitor(mockMgr)

        await withClipboardMutationSuppressed(async () => {
            // suppressUntil = 0 + 1000 = 1000
        })
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
        const result = await withClipboardMutationSuppressed(async () => 42)
        expect(result).toBe(42)
    })

    it('suppression leaves cleanup window when inner function throws', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(5000)

        startClipboardMonitor(mockMgr)

        await expect(
            withClipboardMutationSuppressed(async () => {
                throw new Error('boom')
            }),
        ).rejects.toThrow('boom')

        // finally block should have set suppressUntil = 5000 + 200 = 5200
        mockClipboardText = 'synced during suppression'
        vi.setSystemTime(5199)
        pollClipboardMonitorOnce(mockMgr)
        // last_text synced to 'synced during suppression' even though suppressed
        expect(mockFocusOrCreate).not.toHaveBeenCalled()

        mockClipboardText = 'after throw'
        vi.setSystemTime(5200)
        pollClipboardMonitorOnce(mockMgr)
        expect(mockFocusOrCreate).toHaveBeenCalled()
    })
})
