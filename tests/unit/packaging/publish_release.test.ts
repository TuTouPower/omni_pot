import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const script_path = join(process.cwd(), 'scripts/publish_release.mjs')
const module_path = pathToFileURL(script_path).href
const app_version = (createRequire(import.meta.url)('../../../package.json') as { version: string }).version
const installer_name = `OmniPot${app_version}.exe`
const portable_name = `OmniPot${app_version}-portable.exe`

async function with_temp_dir(run: (dir: string) => Promise<void>) {
    const dir = await mkdtemp(join(tmpdir(), 'omni-pot-publish-test-'))

    try {
        await run(dir)
    } finally {
        await rm(dir, { recursive: true, force: true })
    }
}

type ReleaseFile = {
    r2_latest_key: string
}

type CollectStaleR2LatestKeys = (previous_metadata: unknown, current_files: ReleaseFile[]) => string[]
type SpawnCommand = (command: string) => string
type SpawnShell = (command: string) => boolean
type MatchesGitHubAssetMetadata = (asset: { size?: number; digest?: string }, file: { size: number; sha256: string }) => boolean
type BuildR2Command = (args: string[]) => { command: string; args: string[] }
type IsNotFoundError = (result: { stdout?: string; stderr?: string }) => boolean

describe('publish release helpers', () => {
    it('uses shell only for Windows npm command shims', async () => {
        const { spawn_command, spawn_shell } = (await import(module_path)) as { spawn_command: SpawnCommand; spawn_shell: SpawnShell }

        expect(spawn_command('npm')).toBe('npm')
        expect(spawn_command('npx')).toBe('npx')
        expect(spawn_command('gh')).toBe('gh')
        expect(spawn_shell('npm')).toBe(process.platform === 'win32')
        expect(spawn_shell('npx')).toBe(process.platform === 'win32')
        expect(spawn_shell('gh')).toBe(false)
    })

    it('recognizes Wrangler missing-key output as not found', async () => {
        const { is_not_found_error } = (await import(module_path)) as { is_not_found_error: IsNotFoundError }

        expect(is_not_found_error({ stderr: 'The specified key does not exist.' })).toBe(true)
    })

    it('runs R2 wrangler commands through WSL to reuse the existing Cloudflare login', async () => {
        const { build_r2_command } = (await import(module_path)) as { build_r2_command: BuildR2Command }
        const command = build_r2_command(['r2', 'object', 'put', 'releases/omni-pot/latest.json', '--file', 'build/release/latest.json', '--remote'])

        expect(command.command).toBe('wsl.exe')
        expect(command.args).toEqual([
            '--cd',
            '/home/karon/karson_ubuntu/cloudflare_service',
            'npx',
            'wrangler',
            'r2',
            'object',
            'put',
            'releases/omni-pot/latest.json',
            '--file',
            'build/release/latest.json',
            '--remote',
        ])
    })

    it('accepts existing GitHub assets when API size and digest match local metadata', async () => {
        const { matches_github_asset_metadata } = (await import(module_path)) as { matches_github_asset_metadata: MatchesGitHubAssetMetadata }
        const file = { size: 123, sha256: 'a'.repeat(64) }

        expect(matches_github_asset_metadata({ size: 123, digest: `sha256:${'a'.repeat(64)}` }, file)).toBe(true)
        expect(matches_github_asset_metadata({ size: 123, digest: `sha256:${'b'.repeat(64)}` }, file)).toBe(false)
        expect(matches_github_asset_metadata({ size: 456, digest: `sha256:${'a'.repeat(64)}` }, file)).toBe(false)
    })

    it('collects stale R2 latest objects from previous metadata', async () => {
        const { collect_stale_r2_latest_keys } = (await import(module_path)) as { collect_stale_r2_latest_keys: CollectStaleR2LatestKeys }
        const previous_metadata = {
            files: {
                windows_installer: {
                    r2_url: 'https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot0.9.9.exe',
                },
                windows_portable: {
                    r2_url: `https://downloads.zzzkkkccc.site/omni-pot/latest/${portable_name}`,
                },
            },
        }
        const current_files = [
            { r2_latest_key: `omni-pot/latest/${installer_name}` },
            { r2_latest_key: `omni-pot/latest/${portable_name}` },
        ]

        expect(collect_stale_r2_latest_keys(previous_metadata, current_files)).toEqual(['omni-pot/latest/OmniPot0.9.9.exe'])
    })

    it('prints R2 latest file upload and verification before latest metadata upload', async () => {
        await with_temp_dir(async (dir) => {
            const release_dir = join(dir, 'build', 'release')
            await mkdir(release_dir, { recursive: true })
            await writeFile(join(dir, 'package.json'), JSON.stringify({ version: app_version }))
            await writeFile(join(release_dir, installer_name), 'installer')
            await writeFile(join(release_dir, portable_name), 'portable')

            const result = spawnSync(process.execPath, [script_path, '--skip-dist', '--dry-run'], {
                cwd: dir,
                encoding: 'utf8',
            })

            expect(result.status, result.stderr).toBe(0)
            const latest_file_upload = result.stdout.indexOf(`releases/omni-pot/latest/${installer_name}`)
            const latest_file_verify = result.stdout.indexOf(`# fetch https://downloads.zzzkkkccc.site/omni-pot/latest/${installer_name} and verify sha256/size`)
            const r2_latest_json_upload = result.stdout.indexOf('releases/omni-pot/latest.json')
            const github_latest_json_upload = result.stdout.indexOf(`gh release upload v${app_version} '${join(release_dir, 'latest.json')}'`)
            expect(latest_file_upload).toBeGreaterThanOrEqual(0)
            expect(latest_file_verify).toBeGreaterThan(latest_file_upload)
            expect(r2_latest_json_upload).toBeGreaterThan(latest_file_verify)
            expect(github_latest_json_upload).toBeGreaterThan(latest_file_verify)
        })
    })

    it('rejects mismatched --version because package.json is the source of truth', async () => {
        await with_temp_dir(async (dir) => {
            await writeFile(join(dir, 'package.json'), JSON.stringify({ version: app_version }))

            const result = spawnSync(process.execPath, [script_path, '--version', '0.0.0', '--skip-dist', '--dry-run'], {
                cwd: dir,
                encoding: 'utf8',
            })

            expect(result.status).toBe(1)
            expect(result.stderr).toContain(`--version 0.0.0 does not match package.json version ${app_version}`)
        })
    })
})
