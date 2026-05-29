import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import { WindowLabel } from '../../electron/windows/types'

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/tmp'),
        getVersion: vi.fn(() => '1.0.0'),
    },
    dialog: {
        showErrorBox: vi.fn(),
        showMessageBox: vi.fn(),
    },
    ipcMain: {
        handle: vi.fn(),
    },
    shell: {
        openPath: vi.fn(),
    },
}))

describe('updater security helpers', () => {
    beforeEach(async () => {
        const updater = await import('../../electron/updater')
        updater.bind_update_release_assets([])
    })

    it('resolves downloads only from release assets bound by main process', async () => {
        const { bind_update_release_assets, resolve_bound_update_asset } = await import('../../electron/updater')
        bind_update_release_assets([
            { name: 'omni_pot.exe', url: 'https://github.com/TuTouPower/omni_pot_release/releases/download/v1.0.0/omni_pot.exe' },
        ])

        expect(resolve_bound_update_asset('omni_pot.exe')).toEqual({
            name: 'omni_pot.exe',
            url: 'https://github.com/TuTouPower/omni_pot_release/releases/download/v1.0.0/omni_pot.exe',
        })
        expect(() => { resolve_bound_update_asset('evil.exe') }).toThrow('Unknown update asset')
        expect(() => { resolve_bound_update_asset({ name: 'omni_pot.exe' }) }).toThrow('Invalid update asset')
    })

    it('allows only release asset URLs before redirect and GitHub storage URLs after redirect', async () => {
        const { assert_allowed_download_url } = await import('../../electron/updater')

        expect(assert_allowed_download_url('https://github.com/TuTouPower/omni_pot_release/releases/download/v1.0.0/omni_pot.exe', false).hostname).toBe('github.com')
        expect(assert_allowed_download_url('https://objects.githubusercontent.com/github-production-release-asset/file', true).hostname).toBe('objects.githubusercontent.com')
        expect(() => { assert_allowed_download_url('https://objects.githubusercontent.com/github-production-release-asset/file', false) }).toThrow('Unsupported update download URL')
        expect(() => { assert_allowed_download_url('https://example.com/omni_pot.exe', false) }).toThrow('Unsupported update download URL')
    })

    it('limits download IPC to the updater window', async () => {
        const { assert_updater_sender } = await import('../../electron/updater')
        const sender = { id: 42 } as WebContents
        const manager = {
            getLabelById: vi.fn(() => WindowLabel.UPDATER),
        }

        expect(() => { assert_updater_sender(manager as never, sender) }).not.toThrow()
        manager.getLabelById.mockReturnValue(WindowLabel.CONFIG)
        expect(() => { assert_updater_sender(manager as never, sender) }).toThrow('Unauthorized updater IPC sender')
    })
})
