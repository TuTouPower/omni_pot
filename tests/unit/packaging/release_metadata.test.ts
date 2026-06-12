import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const module_path = new URL('../../../scripts/release_metadata.mjs', import.meta.url).pathname
const app_version = (createRequire(import.meta.url)('../../../package.json') as { version: string }).version
const old_version = '0.9.9'
const containing_version = `1${app_version}`
const longer_version = `${app_version}.1`
const installer_name = `OmniPot-${app_version}-windows-setup.exe`
const portable_name = `OmniPot-${app_version}-windows-portable.exe`
const version_error_pattern = new RegExp(`version ${app_version.replaceAll('.', '\\.')}`)

type ReleaseFileMetadata = {
    os: string
    type: string
    filename: string
    source_path: string
    sha256: string
    size: number
    github_url: string
    r2_url: string
    r2_version_key: string
    r2_latest_key: string
}

type ReleaseMetadata = {
    format_version: number
    version: string
    released_at: string
    files: ReleaseFileMetadata[]
}

type BuildLatestMetadata = (options: { version: string; release_dir: string; released_at?: Date }) => Promise<ReleaseMetadata>
type WriteLatestJson = (release_dir: string, metadata: unknown) => Promise<string>
type PublicMetadata = (metadata: ReleaseMetadata) => unknown

async function with_temp_dir(run: (dir: string) => Promise<void>) {
    const dir = await mkdtemp(join(tmpdir(), 'omni-pot-release-'))

    try {
        await run(dir)
    } finally {
        await rm(dir, { recursive: true, force: true })
    }
}

function sha256_text(value: string) {
    return createHash('sha256').update(value).digest('hex')
}

describe('release metadata helpers', () => {
    it('builds latest metadata with dynamic hashes, file data, URLs, and CST released_at', async () => {
        const { build_latest_metadata } = (await import(module_path)) as { build_latest_metadata: BuildLatestMetadata }

        await with_temp_dir(async (dir) => {
            await writeFile(join(dir, installer_name), 'installer')
            await writeFile(join(dir, portable_name), 'portable')
            await writeFile(join(dir, `OmniPot-${old_version}-windows-setup.exe`), 'old-installer')
            await writeFile(join(dir, `OmniPot-${old_version}-windows-portable.exe`), 'old-portable')

            const metadata = await build_latest_metadata({
                version: app_version,
                release_dir: dir,
                released_at: new Date('2026-05-31T00:00:00.000Z'),
            })

            expect(metadata.format_version).toBe(2)
            expect(metadata.version).toBe(app_version)
            expect(metadata.released_at).toBe('2026-05-31T08:00:00.000+08:00')
            expect(metadata.files).toHaveLength(2)
            expect(metadata.files[0]).toMatchObject({
                os: 'windows',
                type: 'setup',
                filename: installer_name,
                source_path: join(dir, installer_name),
                sha256: sha256_text('installer'),
                size: 9,
                github_url: `https://github.com/TuTouPower/omni_pot/releases/download/v${app_version}/${installer_name}`,
                r2_url: `https://downloads.zzzkkkccc.site/omni-pot/latest/${installer_name}`,
            })
            expect(metadata.files[1]).toMatchObject({
                os: 'windows',
                type: 'portable',
                filename: portable_name,
                source_path: join(dir, portable_name),
                sha256: sha256_text('portable'),
                size: 8,
                github_url: `https://github.com/TuTouPower/omni_pot/releases/download/v${app_version}/${portable_name}`,
                r2_url: `https://downloads.zzzkkkccc.site/omni-pot/latest/${portable_name}`,
            })
        })
    })

    it('throws with missing portable kind when portable is absent', async () => {
        const { build_latest_metadata } = (await import(module_path)) as { build_latest_metadata: BuildLatestMetadata }

        await with_temp_dir(async (dir) => {
            await writeFile(join(dir, installer_name), 'installer')

            await expect(build_latest_metadata({ version: app_version, release_dir: dir })).rejects.toThrow('portable')
        })
    })

    it('throws with missing setup kind when setup is absent', async () => {
        const { build_latest_metadata } = (await import(module_path)) as { build_latest_metadata: BuildLatestMetadata }

        await with_temp_dir(async (dir) => {
            await writeFile(join(dir, portable_name), 'portable')

            await expect(build_latest_metadata({ version: app_version, release_dir: dir })).rejects.toThrow('setup')
        })
    })

    it('rejects release files that do not match the target version', async () => {
        const { build_latest_metadata } = (await import(module_path)) as { build_latest_metadata: BuildLatestMetadata }

        await with_temp_dir(async (dir) => {
            await writeFile(join(dir, `OmniPot-${old_version}-windows-setup.exe`), 'old-installer')
            await writeFile(join(dir, `OmniPot-${old_version}-windows-portable.exe`), 'old-portable')

            await expect(build_latest_metadata({ version: app_version, release_dir: dir })).rejects.toThrow(version_error_pattern)
        })
    })

    it('rejects release files with versions that only contain the target version as a substring', async () => {
        const { build_latest_metadata } = (await import(module_path)) as { build_latest_metadata: BuildLatestMetadata }

        await with_temp_dir(async (dir) => {
            await writeFile(join(dir, `OmniPot-${containing_version}-windows-setup.exe`), 'wrong-installer')
            await writeFile(join(dir, `OmniPot-${containing_version}-windows-portable.exe`), 'wrong-portable')

            await expect(build_latest_metadata({ version: app_version, release_dir: dir })).rejects.toThrow(version_error_pattern)
        })
    })

    it('rejects release files with longer patch versions that start with the target version', async () => {
        const { build_latest_metadata } = (await import(module_path)) as { build_latest_metadata: BuildLatestMetadata }

        await with_temp_dir(async (dir) => {
            await writeFile(join(dir, `OmniPot-${longer_version}-windows-setup.exe`), 'wrong-installer')
            await writeFile(join(dir, `OmniPot-${longer_version}-windows-portable.exe`), 'wrong-portable')

            await expect(build_latest_metadata({ version: app_version, release_dir: dir })).rejects.toThrow(version_error_pattern)
        })
    })

    it('writes latest.json using 4-space pretty JSON with a trailing newline', async () => {
        const { write_latest_json } = (await import(module_path)) as { write_latest_json: WriteLatestJson }

        await with_temp_dir(async (dir) => {
            const metadata = { format_version: 2, version: app_version, released_at: '2026-05-31T00:00:00.000Z', files: [] }
            const path = await write_latest_json(dir, metadata)
            const text = await readFile(path, 'utf8')

            expect(text).toBe(`${JSON.stringify(metadata, null, 4)}\n`)
            expect(text).toContain('    "format_version": 2')
        })
    })

    it('builds deterministic R2 keys for version archive and latest objects', async () => {
        const { build_latest_metadata } = (await import(module_path)) as { build_latest_metadata: BuildLatestMetadata }

        await with_temp_dir(async (dir) => {
            await writeFile(join(dir, installer_name), 'installer')
            await writeFile(join(dir, portable_name), 'portable')

            const metadata = await build_latest_metadata({
                version: app_version,
                release_dir: dir,
                released_at: new Date('2026-05-31T00:00:00.000Z'),
            })

            expect(metadata.files[0].r2_version_key).toBe(`omni-pot/${app_version}/${installer_name}`)
            expect(metadata.files[0].r2_latest_key).toBe(`omni-pot/latest/${installer_name}`)
            expect(metadata.files[1].r2_version_key).toBe(`omni-pot/${app_version}/${portable_name}`)
            expect(metadata.files[1].r2_latest_key).toBe(`omni-pot/latest/${portable_name}`)
        })
    })

    it('removes local upload-only fields from public metadata', async () => {
        const { build_latest_metadata, public_metadata } = (await import(module_path)) as {
            build_latest_metadata: BuildLatestMetadata
            public_metadata: PublicMetadata
        }

        await with_temp_dir(async (dir) => {
            await writeFile(join(dir, installer_name), 'installer')
            await writeFile(join(dir, portable_name), 'portable')

            const metadata = await build_latest_metadata({ version: app_version, release_dir: dir })
            const public_json = JSON.stringify(public_metadata(metadata))

            expect(public_json).not.toContain('source_path')
            expect(public_json).not.toContain('r2_version_key')
            expect(public_json).not.toContain('r2_latest_key')
        })
    })
})
