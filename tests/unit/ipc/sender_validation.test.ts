import { describe, expect, it, vi, type Mock } from 'vitest'
import { BrowserWindow, type WebContents } from 'electron'
import { WindowLabel } from '../../../src/main/windows/types'

vi.mock('electron', () => ({
    BrowserWindow: {
        fromWebContents: vi.fn(),
    },
}))

describe('IPC sender validation', () => {
    it('allows only senders from permitted window labels', async () => {
        const { assert_sender_label } = await import('../../../src/main/ipc/sender_validation')
        const sender = { id: 10 } as WebContents
        const manager = { getLabelById: vi.fn(() => WindowLabel.CONFIG) }
        const browser_window = BrowserWindow as unknown as { fromWebContents: Mock }
        browser_window.fromWebContents.mockReturnValue({ id: 7 })

        expect(assert_sender_label(manager, { sender } as Electron.IpcMainInvokeEvent, [WindowLabel.CONFIG], 'config:set')).toBe(WindowLabel.CONFIG)
        expect(manager.getLabelById).toHaveBeenCalledWith(7)
        expect(() => {
            assert_sender_label(manager, { sender } as Electron.IpcMainInvokeEvent, [WindowLabel.TRANSLATE], 'config:set')
        }).toThrow('Unauthorized IPC sender for config:set')
    })
})
