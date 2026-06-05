import { describe, expect, it, vi } from 'vitest'

const shell_open_external = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
    BrowserWindow: { getFocusedWindow: vi.fn(() => null) },
    dialog: { showSaveDialog: vi.fn() },
    ipcMain: { handle: vi.fn() },
    shell: { openExternal: shell_open_external },
}))

vi.mock('../../../electron/config/store', () => ({
    getUserDataDir: vi.fn(() => process.cwd()),
}))

vi.mock('../../../electron/log', () => ({
    getLogDir: vi.fn(() => process.cwd()),
    log: { scope: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}))

vi.mock('../../../electron/backup/index', () => ({
    create_zip: vi.fn(),
}))

describe('open_external_safely', () => {
    it('rejects file URLs', async () => {
        const { open_external_safely } = await import('../../../electron/ipc/shell_handlers')

        await expect(open_external_safely('file:///C:/Windows/System32/cmd.exe')).resolves.toBe(false)
        expect(shell_open_external).not.toHaveBeenCalled()
    })
})
