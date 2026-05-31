import { createHash } from 'crypto'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { BrowserWindow, app, type WebContents } from 'electron'
import { WindowLabel } from '../../electron/windows/types'

const app_version = (createRequire(import.meta.url)('../../package.json') as { version: string }).version
const app_installer_name = `OmniPot${app_version}.exe`
const app_installer_github_url = `https://github.com/TuTouPower/omni_pot_release/releases/download/v${app_version}/${app_installer_name}`
const app_installer_r2_url = `https://downloads.zzzkkkccc.site/omni-pot/latest/${app_installer_name}`

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/tmp'),
        getVersion: vi.fn(() => app_version),
    },
    BrowserWindow: {
        fromWebContents: vi.fn(),
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
            { name: app_installer_name, url: app_installer_github_url },
        ])

        expect(resolve_bound_update_asset(app_installer_name)).toEqual({
            name: app_installer_name,
            url: app_installer_github_url,
        })
        expect(() => { resolve_bound_update_asset('evil.exe') }).toThrow('Unknown update asset')
        expect(() => { resolve_bound_update_asset({ name: app_installer_name }) }).toThrow('Invalid update asset')
    })

    it('allows only release asset URLs before redirect and GitHub storage URLs after redirect', async () => {
        const { assert_allowed_download_url } = await import('../../electron/updater')

        expect(assert_allowed_download_url(app_installer_github_url, false).hostname).toBe('github.com')
        expect(assert_allowed_download_url(app_installer_r2_url, false).hostname).toBe('downloads.zzzkkkccc.site')
        expect(assert_allowed_download_url('https://objects.githubusercontent.com/github-production-release-asset/file', true).hostname).toBe('objects.githubusercontent.com')
        expect(() => { assert_allowed_download_url(`https://github.com/TuTouPower/omni_pot_release/releases/download/v${app_version}/omni_pot.exe`, false) }).toThrow('Unsupported update download URL')
        expect(() => { assert_allowed_download_url('https://downloads.zzzkkkccc.site/omni-pot/' + app_installer_name, false) }).toThrow('Unsupported update download URL')
        expect(() => { assert_allowed_download_url('https://objects.githubusercontent.com/github-production-release-asset/file', false) }).toThrow('Unsupported update download URL')
        expect(() => { assert_allowed_download_url('https://example.com/omni_pot.exe', false) }).toThrow('Unsupported update download URL')
    })

    it('parses only GitHub sha256 asset digests', async () => {
        const { parse_sha256_digest } = await import('../../electron/updater')
        const hash = createHash('sha256').update('update').digest('hex')

        expect(parse_sha256_digest(`sha256:${hash}`)).toBe(hash)
        expect(parse_sha256_digest(undefined)).toBeNull()
        expect(() => { parse_sha256_digest(hash) }).toThrow('Unsupported update asset digest')
        expect(() => { parse_sha256_digest('md5:00000000000000000000000000000000') }).toThrow('Unsupported update asset digest')
    })

    it('waits for failed download cleanup before trying fallback sources', async () => {
        const source = await readFile(join(process.cwd(), 'electron/updater/index.ts'), 'utf8')

        expect(source).not.toContain('rm(output_path, { force: true }).catch(() => {})')
    })

    it('limits download IPC to the updater window', async () => {
        const { assert_updater_sender } = await import('../../electron/updater')
        const sender = { id: 42 } as WebContents
        const browser_window = BrowserWindow as unknown as { fromWebContents: Mock }
        browser_window.fromWebContents.mockReturnValue({ id: 7 })
        const manager = {
            getLabelById: vi.fn(() => WindowLabel.UPDATER),
        }

        expect(() => { assert_updater_sender(manager as never, sender) }).not.toThrow()
        expect(manager.getLabelById).toHaveBeenCalledWith(7)
        manager.getLabelById.mockReturnValue(WindowLabel.CONFIG)
        expect(() => { assert_updater_sender(manager as never, sender) }).toThrow('Unauthorized updater IPC sender')
    })
})

const test_hash = 'a'.repeat(64)

function latest_metadata(version = '1.1.0', installer_hash = test_hash) {
    return {
        format_version: 1,
        version,
        released_at: '2026-05-31T00:00:00.000Z',
        files: {
            windows_installer: {
                filename: `OmniPot${version}.exe`,
                versioned_filename: `OmniPot${version}.exe`,
                sha256: installer_hash,
                size: 123,
                github_url: `https://github.com/TuTouPower/omni_pot_release/releases/download/v${version}/OmniPot${version}.exe`,
                r2_url: `https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot${version}.exe`,
            },
            windows_portable: {
                filename: `OmniPot${version}-portable.exe`,
                versioned_filename: `OmniPot${version}-portable.exe`,
                sha256: 'b'.repeat(64),
                size: 456,
                github_url: `https://github.com/TuTouPower/omni_pot_release/releases/download/v${version}/OmniPot${version}-portable.exe`,
                r2_url: `https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot${version}-portable.exe`,
            },
        },
    }
}

function mock_metadata_fetch(github_body: unknown, r2_body: unknown): void {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(url.includes('downloads.zzzkkkccc.site') ? r2_body : github_body),
    })))
}

describe('updater latest metadata', () => {
    beforeEach(() => {
        delete process.env['PORTABLE_EXECUTABLE_DIR']
        const mocked_app = app as unknown as { getVersion: Mock }
        mocked_app.getVersion.mockReturnValue(app_version)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        delete process.env['PORTABLE_EXECUTABLE_DIR']
    })

    it('parses latest.json metadata and rejects non-standard filenames', async () => {
        const { parse_latest_metadata } = await import('../../electron/updater')
        const metadata = parse_latest_metadata(latest_metadata())

        expect(metadata.files.windows_installer.filename).toBe('OmniPot1.1.0.exe')
        expect(metadata.files.windows_portable.filename).toBe('OmniPot1.1.0-portable.exe')

        const invalid = latest_metadata()
        invalid.files.windows_installer.filename = 'BadName1.1.0.exe'
        invalid.files.windows_installer.versioned_filename = 'BadName1.1.0.exe'
        expect(() => { parse_latest_metadata(invalid) }).toThrow('Invalid latest metadata files.windows_installer.filename')

        const wrong_prefix = latest_metadata()
        wrong_prefix.files.windows_installer.filename = 'OmniPotBad1.1.0.exe'
        wrong_prefix.files.windows_installer.versioned_filename = 'OmniPotBad1.1.0.exe'
        expect(() => { parse_latest_metadata(wrong_prefix) }).toThrow('Invalid latest metadata files.windows_installer.filename')

        const wrong_github_url = latest_metadata()
        wrong_github_url.files.windows_installer.github_url = 'https://github.com/TuTouPower/omni_pot_release/releases/download/v1.1.0/BadName1.1.0.exe'
        expect(() => { parse_latest_metadata(wrong_github_url) }).toThrow('Invalid latest metadata files.windows_installer.github_url')

        const wrong_r2_url = latest_metadata()
        wrong_r2_url.files.windows_installer.r2_url = 'https://downloads.zzzkkkccc.site/omni-pot/' + 'OmniPot1.1.0.exe'
        expect(() => { parse_latest_metadata(wrong_r2_url) }).toThrow('Invalid latest metadata files.windows_installer.r2_url')
    })

    it('does not update for unsupported latest.json format versions', async () => {
        const { get_update_release_info } = await import('../../electron/updater')
        mock_metadata_fetch({ ...latest_metadata(), format_version: 99 }, latest_metadata())

        await expect(get_update_release_info()).rejects.toThrow('Unsupported latest metadata format_version')
    })

    it('uses dual-source metadata when version, sha256, and size match', async () => {
        const { get_update_release_info } = await import('../../electron/updater')
        mock_metadata_fetch(latest_metadata(), latest_metadata())

        const release = await get_update_release_info()

        expect(release?.version).toBe('1.1.0')
        expect(release?.assets).toEqual([{ name: 'OmniPot1.1.0.exe', url: 'https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot1.1.0.exe', size: 123, digest: `sha256:${test_hash}`, fallback_urls: ['https://github.com/TuTouPower/omni_pot_release/releases/download/v1.1.0/OmniPot1.1.0.exe'] }])
    })

    it('treats missing latest.json on both sources as no available update', async () => {
        const { get_update_release_info } = await import('../../electron/updater')
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({}),
        })))

        await expect(get_update_release_info()).resolves.toBeNull()
    })

    it('uses one source when the other source cannot be fetched', async () => {
        const { get_update_release_info } = await import('../../electron/updater')
        vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.includes('downloads.zzzkkkccc.site')
            ? { ok: true, status: 200, json: () => Promise.resolve(latest_metadata()) }
            : { ok: false, status: 503, json: () => Promise.resolve({}) })))

        const release = await get_update_release_info()

        expect(release?.assets[0]?.name).toBe('OmniPot1.1.0.exe')
    })

    it('rejects dual-source metadata conflicts', async () => {
        const { get_update_release_info } = await import('../../electron/updater')
        mock_metadata_fetch(latest_metadata(), latest_metadata('1.1.0', 'c'.repeat(64)))

        await expect(get_update_release_info()).rejects.toThrow('Latest metadata conflict: windows_installer mismatch')
    })

    it('selects portable assets when running as portable', async () => {
        const { get_update_release_info, get_windows_update_file_key } = await import('../../electron/updater')
        process.env['PORTABLE_EXECUTABLE_DIR'] = '/portable'
        mock_metadata_fetch(latest_metadata(), latest_metadata())

        const release = await get_update_release_info()

        expect(get_windows_update_file_key()).toBe('windows_portable')
        expect(release?.assets[0]?.name).toBe('OmniPot1.1.0-portable.exe')
        expect(release?.assets[0]?.url).toBe('https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot1.1.0-portable.exe')
    })
})
