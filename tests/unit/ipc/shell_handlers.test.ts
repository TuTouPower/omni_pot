import { describe, expect, it, vi } from 'vitest'

const shell_open_external = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
    BrowserWindow: { getFocusedWindow: vi.fn(() => null) },
    dialog: { showSaveDialog: vi.fn() },
    ipcMain: { handle: vi.fn() },
    shell: { openExternal: shell_open_external },
}))

vi.mock('../../../src/main/config/store', () => ({
    getUserDataDir: vi.fn(() => process.cwd()),
}))

vi.mock('../../../src/main/log', () => ({
    getLogDir: vi.fn(() => process.cwd()),
    log: { scope: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}))

vi.mock('../../../src/main/backup/index', () => ({
    create_zip: vi.fn(),
}))

describe('open_external_safely', () => {
    it('rejects file URLs', async () => {
        const { open_external_safely } = await import('../../../src/main/ipc/shell_handlers')

        await expect(open_external_safely('file:///C:/Windows/System32/cmd.exe')).resolves.toBe(false)
        expect(shell_open_external).not.toHaveBeenCalled()
    })

    it('allows wj.qq.com survey URLs', async () => {
        const { open_external_safely } = await import('../../../src/main/ipc/shell_handlers')
        shell_open_external.mockClear()

        await expect(open_external_safely('https://wj.qq.com/edit?sid=27007386')).resolves.toBe(true)
        expect(shell_open_external).toHaveBeenCalledWith('https://wj.qq.com/edit?sid=27007386')
    })

    it('rejects unknown domains', async () => {
        const { open_external_safely } = await import('../../../src/main/ipc/shell_handlers')
        shell_open_external.mockClear()

        await expect(open_external_safely('https://evil.example.com/phish')).resolves.toBe(false)
        expect(shell_open_external).not.toHaveBeenCalled()
    })
})
