import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as node_crypto from 'node:crypto'
import type { getSelectedTextViaClipboard as getSelectedTextViaClipboardType } from '../../../electron/selection/clipboard'

// @electron-mock Required: Vitest cannot access real system clipboard.
// This mock stubs Electron clipboard (read/write/clear) and crypto.randomUUID
// to test clipboard restore, read suppression, and UUID determinism.
// Real clipboard round-trips are covered by E2E (translate_behavior.spec.ts,
// updater_and_tray.spec.ts clipboard monitor tests).
const { mockReadText, mockWriteText, mockClear, mockWrite, mockRandomUUID } = vi.hoisted(() => {
    let mockClipboardText = ''
    const uuidFn = vi.fn()
    return {
        mockReadText: () => mockClipboardText,
        mockWriteText: (text: string) => { mockClipboardText = text },
        mockClear: vi.fn(),
        mockWrite: vi.fn(),
        mockRandomUUID: uuidFn,
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

    beforeEach(async () => {
        vi.clearAllMocks()
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
        getSelectedTextViaClipboard = mod.getSelectedTextViaClipboard
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
