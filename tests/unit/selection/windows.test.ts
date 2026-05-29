import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SelectedTextResult } from '../../../electron/selection/index'
import type { getSelectedTextViaClipboard as getSelectedTextViaClipboardType } from '../../../electron/selection/clipboard'

const {
    mockSendInput,
    mockCoInitializeEx,
    mockCoCreateInstance,
    mockCoUninitialize,
    mockSysFreeString,
    mockKoffiDecode,
    mockKoffiCall,
    mockGetSelectedTextViaClipboard,
    mockWithClipboardMutationSuppressed,
} = vi.hoisted(() => {
    return {
        mockSendInput: vi.fn(),
        mockCoInitializeEx: vi.fn(),
        mockCoCreateInstance: vi.fn(),
        mockCoUninitialize: vi.fn(),
        mockSysFreeString: vi.fn(),
        mockKoffiDecode: vi.fn(),
        mockKoffiCall: vi.fn(),
        mockGetSelectedTextViaClipboard: vi.fn(),
        mockWithClipboardMutationSuppressed: vi.fn(),
    }
})

vi.mock('koffi', () => ({
    default: {
        load: () => ({
            func: (signature: string) => {
                if (signature.includes('SendInput')) return mockSendInput
                if (signature.includes('CoInitializeEx')) return mockCoInitializeEx
                if (signature.includes('CoCreateInstance')) return mockCoCreateInstance
                if (signature.includes('CoUninitialize')) return mockCoUninitialize
                if (signature.includes('SysFreeString')) return mockSysFreeString
                return vi.fn()
            },
        }),
        struct: vi.fn((name: string) => name),
        union: vi.fn((name: string) => name),
        proto: vi.fn((signature: string) => signature),
        sizeof: vi.fn(() => 40),
        decode: mockKoffiDecode,
        call: mockKoffiCall,
    },
}))

vi.mock('../../../electron/selection/clipboard', () => ({
    getSelectedTextViaClipboard: mockGetSelectedTextViaClipboard,
}))

vi.mock('../../../electron/clipboard/index', () => ({
    withClipboardMutationSuppressed: mockWithClipboardMutationSuppressed,
}))

const pointers = {
    automation: { name: 'automation' },
    element: { name: 'element' },
    pattern: { name: 'pattern' },
    ranges: { name: 'ranges' },
    range: { name: 'range' },
    text: { name: 'text' },
    vtable: { name: 'vtable' },
}

function mock_successful_uia_selection(): void {
    mockCoInitializeEx.mockReturnValue(0)
    mockCoCreateInstance.mockImplementation((_clsid, _outer, _ctx, _iid, out: Array<object | null>) => {
        out[0] = pointers.automation
        return 0
    })
    mockKoffiDecode.mockImplementation((value: object, type: string, count?: number) => {
        if (type === 'str16') return 'uia selection'
        if (count) return Array.from({ length: count }, (_unused, index) => ({ fn: index }))
        return pointers.vtable
    })
    mockKoffiCall.mockImplementation((_fn: object, proto: string, ...args: unknown[]) => {
        if (proto.includes('UiaRelease')) return 1
        if (proto.includes('UiaGetFocusedElement')) {
            (args[1] as Array<object | null>)[0] = pointers.element
            return 0
        }
        if (proto.includes('UiaGetCurrentPattern')) {
            (args[2] as Array<object | null>)[0] = pointers.pattern
            return 0
        }
        if (proto.includes('UiaGetSelection')) {
            (args[1] as Array<object | null>)[0] = pointers.ranges
            return 0
        }
        if (proto.includes('UiaGetLength')) {
            (args[1] as number[])[0] = 1
            return 0
        }
        if (proto.includes('UiaGetElement')) {
            (args[2] as Array<object | null>)[0] = pointers.range
            return 0
        }
        if (proto.includes('UiaGetText')) {
            (args[2] as Array<object | null>)[0] = pointers.text
            return 0
        }
        return 0
    })
}

describe('readSelectedTextWindows fallback chain', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
        mockCoInitializeEx.mockReturnValue(-2147417850)
        mockCoCreateInstance.mockReturnValue(0)
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

    it('returns UIA text and releases COM resources', async () => {
        mock_successful_uia_selection()
        const { readSelectedTextWindows } = await import('../../../electron/selection/windows')

        const result = await readSelectedTextWindows()

        expect(result).toEqual({ text: 'uia selection', method: 'uia' })
        expect(mockSysFreeString).toHaveBeenCalledWith(pointers.text)
        expect(mockKoffiCall).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('UiaRelease'), pointers.range)
        expect(mockKoffiCall).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('UiaRelease'), pointers.ranges)
        expect(mockKoffiCall).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('UiaRelease'), pointers.pattern)
        expect(mockKoffiCall).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('UiaRelease'), pointers.element)
        expect(mockKoffiCall).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('UiaRelease'), pointers.automation)
        expect(mockCoUninitialize).toHaveBeenCalledOnce()
        expect(mockGetSelectedTextViaClipboard).not.toHaveBeenCalled()
    })
})
