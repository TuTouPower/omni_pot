import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SelectedTextResult } from '../../../electron/selection/index'
import type { getSelectedTextViaClipboard as getSelectedTextViaClipboardType } from '../../../electron/selection/clipboard'

const { mockSendInput, mockGetSelectedTextViaClipboard, mockWithClipboardMutationSuppressed } = vi.hoisted(() => {
    return {
        mockSendInput: vi.fn(),
        mockGetSelectedTextViaClipboard: vi.fn(),
        mockWithClipboardMutationSuppressed: vi.fn(),
    }
})

vi.mock('koffi', () => ({
    default: {
        load: () => ({
            func: (signature: string) => {
                if (signature.includes('SendInput')) {
                    return mockSendInput
                }
                if (signature.includes('CoInitializeEx')) {
                    return () => -2147417850
                }
                return vi.fn()
            },
        }),
        struct: vi.fn((name: string) => name),
        union: vi.fn((name: string) => name),
        proto: vi.fn((signature: string) => signature),
        sizeof: vi.fn(() => 40),
        decode: vi.fn(),
        call: vi.fn(),
    },
}))

vi.mock('../../../electron/selection/clipboard', () => ({
    getSelectedTextViaClipboard: mockGetSelectedTextViaClipboard,
}))

vi.mock('../../../electron/clipboard/index', () => ({
    withClipboardMutationSuppressed: mockWithClipboardMutationSuppressed,
}))

describe('readSelectedTextWindows fallback chain', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
        mockSendInput.mockReturnValue(4)
        mockWithClipboardMutationSuppressed.mockImplementation(async <T>(fn: () => Promise<T>) => fn())
        mockGetSelectedTextViaClipboard.mockImplementation((
            simulateCopy: Parameters<typeof getSelectedTextViaClipboardType>[0],
            withSuppression: Parameters<typeof getSelectedTextViaClipboardType>[1]
        ) => withSuppression(async () => {
            await simulateCopy()
            return { text: 'clipboard selection', method: 'clipboard' } satisfies SelectedTextResult
        }))
    })

    it('falls back from unavailable UIA to suppressed Ctrl+C clipboard extraction', async () => {
        const { readSelectedTextWindows } = await import('../../../electron/selection/windows')

        const result = await readSelectedTextWindows()

        expect(result).toEqual({ text: 'clipboard selection', method: 'clipboard' })
        expect(mockGetSelectedTextViaClipboard).toHaveBeenCalledOnce()
        expect(mockGetSelectedTextViaClipboard.mock.calls[0]?.[1]).toBe(mockWithClipboardMutationSuppressed)
        expect(mockWithClipboardMutationSuppressed).toHaveBeenCalledOnce()
        expect(mockSendInput).toHaveBeenCalledWith(
            4,
            [
                { type: 1, u: { ki: { wVk: 0x11, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0n } } },
                { type: 1, u: { ki: { wVk: 0x43, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0n } } },
                { type: 1, u: { ki: { wVk: 0x43, wScan: 0, dwFlags: 0x0002, time: 0, dwExtraInfo: 0n } } },
                { type: 1, u: { ki: { wVk: 0x11, wScan: 0, dwFlags: 0x0002, time: 0, dwExtraInfo: 0n } } },
            ],
            40
        )
    })
})
