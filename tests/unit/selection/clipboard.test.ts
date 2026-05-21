import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type * as node_crypto from 'node:crypto'
import type { WindowManager } from '../../../electron/windows/manager'
import type { getSelectedTextViaClipboard as getSelectedTextViaClipboardType } from '../../../electron/selection/clipboard'
import type * as clipboard_monitor from '../../../electron/clipboard/index'

// @electron-mock Required: Vitest cannot access real system clipboard.
// This mock stubs Electron clipboard (read/write/clear) and crypto.randomUUID
// to test clipboard restore, read suppression, and UUID determinism.
// Real clipboard round-trips are covered by E2E (translate_behavior.spec.ts,
// updater_and_tray.spec.ts clipboard monitor tests).
const { mockReadText, mockWriteText, mockClear, mockWrite, mockRandomUUID, mockResetClipboard, mockEvents } = vi.hoisted(() => {
    let mockClipboardText = ''
    const events: string[] = []
    const uuidFn = vi.fn()
    return {
        mockReadText: () => mockClipboardText,
        mockWriteText: (text: string) => {
            events.push(`write_text:${text}`)
            mockClipboardText = text
        },
        mockClear: vi.fn(() => {
            events.push('clear')
            mockClipboardText = ''
        }),
        mockWrite: vi.fn((data: Electron.Data) => {
            events.push(`write:${data.text ?? ''}`)
            mockClipboardText = data.text ?? ''
        }),
        mockRandomUUID: uuidFn,
        mockResetClipboard: () => {
            mockClipboardText = ''
            events.length = 0
        },
        mockEvents: () => events,
    }
})

vi.mock('electron', () => ({
    clipboard: {
        readText: mockReadText,
        writeText: mockWriteText,
        availableFormats: () => ['text/plain'],
        readHTML: () => '',
        readRTF: () => '',
        readBookmark: () => ({ title: '', url: '' }),
        readImage: () => ({ isEmpty: () => true }),
        readBuffer: () => Buffer.alloc(0),
        clear: mockClear,
        write: mockWrite,
        writeBookmark: vi.fn(),
        writeBuffer: vi.fn(),
    },
    NativeImage: {},
}))

vi.mock('node:crypto', async (importOriginal) => {
    const actual = await importOriginal<typeof node_crypto>()
    return {
        ...actual,
        randomUUID: mockRandomUUID,
    }
})

const identitySuppression = async <T>(fn: () => Promise<T>): Promise<T> => fn()

describe('getSelectedTextViaClipboard', () => {
    let getSelectedTextViaClipboard: typeof getSelectedTextViaClipboardType
    let startClipboardMonitor: typeof clipboard_monitor.startClipboardMonitor
    let stopClipboardMonitor: typeof clipboard_monitor.stopClipboardMonitor
    let pollClipboardMonitorOnce: typeof clipboard_monitor.pollClipboardMonitorOnce
    let withClipboardMutationSuppressed: typeof clipboard_monitor.withClipboardMutationSuppressed

    beforeEach(async () => {
        vi.clearAllMocks()
        mockResetClipboard()
        mockRandomUUID.mockReturnValue('test-uuid-1234')

        // resetModules to re-import module under test with fresh mock state
        vi.resetModules()

        // re-register mocks after resetModules
        vi.doMock('electron', () => ({
            clipboard: {
                readText: mockReadText,
                writeText: mockWriteText,
                availableFormats: () => ['text/plain'],
                readHTML: () => '',
                readRTF: () => '',
                readBookmark: () => ({ title: '', url: '' }),
                readImage: () => ({ isEmpty: () => true }),
                readBuffer: () => Buffer.alloc(0),
                clear: mockClear,
                write: mockWrite,
                writeBookmark: vi.fn(),
                writeBuffer: vi.fn(),
            },
            NativeImage: {},
        }))
        vi.doMock('node:crypto', async (importOriginal) => {
            const actual = await importOriginal<typeof node_crypto>()
            return {
                ...actual,
                randomUUID: mockRandomUUID,
            }
        })

        const mod = await import('../../../electron/selection/clipboard')
        const monitor_mod = await import('../../../electron/clipboard/index')
        getSelectedTextViaClipboard = mod.getSelectedTextViaClipboard
        startClipboardMonitor = monitor_mod.startClipboardMonitor
        stopClipboardMonitor = monitor_mod.stopClipboardMonitor
        pollClipboardMonitorOnce = monitor_mod.pollClipboardMonitorOnce
        withClipboardMutationSuppressed = monitor_mod.withClipboardMutationSuppressed
    })

    afterEach(() => {
        stopClipboardMonitor()
    })

    it('returns selected text on successful copy', async () => {
        const simulateCopy = vi.fn().mockImplementation(() => {
            mockWriteText('selected text')
            return Promise.resolve()
        })

        const result = await getSelectedTextViaClipboard(simulateCopy, identitySuppression)

        expect(result).toEqual({ text: 'selected text', method: 'clipboard' })
    })

    it('returns copy-failed when clipboard stays as sentinel', async () => {
        // simulateCopy does nothing, clipboard stays as sentinel
        const simulateCopy = vi.fn().mockResolvedValue(undefined)

        const result = await getSelectedTextViaClipboard(simulateCopy, identitySuppression)

        expect(result).toEqual({ text: '', method: 'clipboard', reason: 'copy-failed' })
    })

    it('succeeds when selected text equals original clipboard content', async () => {
        // Set original clipboard content to "same"
        mockWriteText('same')

        // simulateCopy writes "same" (same as original) into clipboard
        const simulateCopy = vi.fn().mockImplementation(() => {
            mockWriteText('same')
            return Promise.resolve()
        })

        const result = await getSelectedTextViaClipboard(simulateCopy, identitySuppression)

        // sentinel was written first, then simulateCopy changes it to "same"
        expect(result).toEqual({ text: 'same', method: 'clipboard' })
    })

    it('writes sentinel before copying and restores original text afterwards', async () => {
        mockWriteText('original content')
        mockEvents().length = 0

        const simulateCopy = vi.fn().mockImplementation(() => {
            mockWriteText('selected text')
            return Promise.resolve()
        })

        const result = await getSelectedTextViaClipboard(simulateCopy, identitySuppression)

        expect(result).toEqual({ text: 'selected text', method: 'clipboard' })
        expect(mockEvents()).toEqual([
            expect.stringMatching(/^write_text:__OMNI_POT_COPY_SENTINEL_[^_]+__$/),
            'write_text:selected text',
            'clear',
            'write:original content',
        ])
        expect(mockReadText()).toBe('original content')
    })

    it('suppresses clipboard monitor while Ctrl+C fallback mutates and restores clipboard', async () => {
        const focus_or_create = vi.fn()
        const send_when_ready = vi.fn()
        const mock_mgr = {
            focusOrCreate: focus_or_create,
            sendWhenReady: send_when_ready,
        } as unknown as WindowManager

        mockWriteText('original content')
        mockEvents().length = 0
        startClipboardMonitor(mock_mgr)

        const simulateCopy = vi.fn().mockImplementation(() => {
            pollClipboardMonitorOnce(mock_mgr)
            mockWriteText('selected text')
            pollClipboardMonitorOnce(mock_mgr)
            return Promise.resolve()
        })

        const result = await getSelectedTextViaClipboard(
            simulateCopy,
            withClipboardMutationSuppressed,
        )

        expect(result).toEqual({ text: 'selected text', method: 'clipboard' })
        expect(mockReadText()).toBe('original content')
        expect(focus_or_create).not.toHaveBeenCalled()
        expect(send_when_ready).not.toHaveBeenCalled()

        pollClipboardMonitorOnce(mock_mgr)
        expect(focus_or_create).not.toHaveBeenCalled()
        expect(send_when_ready).not.toHaveBeenCalled()
    })

    it('restores clipboard after success', async () => {
        // Set initial clipboard content so backup captures it
        mockWriteText('original content')

        const simulateCopy = vi.fn().mockImplementation(() => {
            mockWriteText('new selected text')
            return Promise.resolve()
        })

        await getSelectedTextViaClipboard(simulateCopy, identitySuppression)

        expect(mockClear).toHaveBeenCalled()
        expect(mockWrite).toHaveBeenCalled()
    })

    it('restores clipboard after simulateCopy throws and returns error', async () => {
        const copyError = new Error('simulate copy exploded')
        const simulateCopy = vi.fn().mockRejectedValue(copyError)

        const result = await getSelectedTextViaClipboard(simulateCopy, identitySuppression)

        expect(result).toMatchObject({
            text: '',
            method: 'clipboard',
            reason: 'error',
        })
        expect(result.error).toBe(copyError)

        // restore still ran despite the error
        expect(mockClear).toHaveBeenCalled()
    })
})
