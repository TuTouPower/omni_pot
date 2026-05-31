import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { app_candidates, should_start_app } from '../../../scripts/restart_dist_app.mjs'
import { restart_args } from '../../../scripts/run_dist.mjs'

type AppCandidates = (repo_root: string, output_dir: string, product_name: string, version: string, is_dir: boolean) => string[]
type RestartArgs = (is_dir: boolean, completed_ok: boolean) => string[]
type ShouldStartApp = (platform: string, always_start: boolean, restart_state_exists: boolean) => boolean

const typed_app_candidates = app_candidates as unknown as AppCandidates
const typed_restart_args = restart_args as unknown as RestartArgs
const typed_should_start_app = should_start_app as unknown as ShouldStartApp

const ROOT_DIR = join(__dirname, '..', '..', '..')
const PACKAGE_JSON_PATH = join(ROOT_DIR, 'package.json')
const RUN_DIST_PATH = join(ROOT_DIR, 'scripts', 'run_dist.mjs')
const ENSURE_ELECTRON_ABI_PATH = join(ROOT_DIR, 'scripts', 'ensure_electron_abi.mjs')

type PackageJson = {
    dependencies?: Record<string, string>
    scripts?: Record<string, string>
    build?: {
        asar?: boolean
        asarUnpack?: string[]
        npmRebuild?: boolean
        productName?: string
        executableName?: string
        artifactName?: string
    }
}

function read_package_json(): PackageJson {
    return JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as PackageJson
}

describe('native module packaging', () => {
    it('keeps native modules unpacked and leaves ABI rebuild to dist scripts', () => {
        const package_json = read_package_json()

        expect(package_json.dependencies).toHaveProperty('better-sqlite3')
        expect(package_json.scripts?.postinstall).toBe('electron-builder install-app-deps')
        expect(package_json.build?.npmRebuild).toBe(false)
        expect(package_json.build?.asar).toBe(true)
        expect(package_json.build?.asarUnpack).toContain('**/*.node')
    })

    it('keeps dist scripts on the run_dist packaging path instead of bypassing electron-builder', () => {
        const package_json = read_package_json()
        const run_dist = readFileSync(RUN_DIST_PATH, 'utf8')

        const dist_tokens = (package_json.scripts?.dist ?? '').split(/\s+/)
        const dist_dir_tokens = (package_json.scripts?.['dist:dir'] ?? '').split(/\s+/)
        expect(dist_tokens).toEqual(['node', 'scripts/run_dist.mjs'])
        expect(dist_dir_tokens).toEqual(['node', 'scripts/run_dist.mjs', '--dir'])

        const build_step_index = run_dist.search(/['"]run['"]\s*,\s*['"]build['"]/)
        const electron_abi_index = run_dist.search(/['"]node['"]\s*,\s*\[\s*['"]scripts\/ensure_electron_abi\.mjs['"]\s*\]/)
        const electron_builder_index = run_dist.search(
            /\[\s*npx_cmd\s*,\s*\[[\s\S]*?['"]electron-builder['"][\s\S]*?is_dir[\s\S]*?['"]--dir['"][\s\S]*?\]\s*\]/,
        )
        expect(build_step_index).toBeGreaterThanOrEqual(0)
        expect(electron_abi_index).toBeGreaterThan(build_step_index)
        expect(electron_builder_index).toBeGreaterThan(electron_abi_index)
    })

    it('verifies better-sqlite3 with Electron before packaging', () => {
        const ensure_electron_abi = readFileSync(ENSURE_ELECTRON_ABI_PATH, 'utf8')

        expect(ensure_electron_abi).toContain("spawnSync(\n    require('electron')")
        expect(ensure_electron_abi).toContain("new (require('better-sqlite3'))(':memory:').close()")
        expect(ensure_electron_abi).toContain("ELECTRON_RUN_AS_NODE: '1'")
        expect(ensure_electron_abi).toMatch(/electron_check\.status\s*!==\s*0/)
    })

    it('rebuilds better-sqlite3 for the current architecture', () => {
        const ensure_electron_abi = readFileSync(ENSURE_ELECTRON_ABI_PATH, 'utf8')

        expect(ensure_electron_abi).toContain('process.env[\'npm_config_arch\'] ?? process.arch')
        expect(ensure_electron_abi).not.toContain('--arch=x64')
    })

    it('passes always-start only after a successful dist build', () => {
        expect(typed_restart_args(false, true)).toEqual(['scripts/restart_dist_app.mjs', '--always'])
        expect(typed_restart_args(false, false)).toEqual(['scripts/restart_dist_app.mjs'])
        expect(typed_restart_args(true, true)).toEqual(['scripts/restart_dist_app.mjs', '--dir', '--always'])
        expect(typed_restart_args(true, false)).toEqual(['scripts/restart_dist_app.mjs', '--dir'])
    })

    it('starts on Windows after a successful dist or previous release close', () => {
        expect(typed_should_start_app('win32', true, false)).toBe(true)
        expect(typed_should_start_app('win32', false, true)).toBe(true)
        expect(typed_should_start_app('win32', false, false)).toBe(false)
        expect(typed_should_start_app('linux', true, true)).toBe(false)
        expect(typed_should_start_app('darwin', true, true)).toBe(false)
    })

    it('prefers the matching packaged app for dist and dist:dir outputs', () => {
        expect(typed_app_candidates('/repo', 'release', 'OmniPot', '1.2.3', false)).toEqual([
            join('/repo', 'release', 'OmniPot1.2.3.exe'),
            join('/repo', 'release', 'win-unpacked', 'OmniPot.exe'),
        ])
        expect(typed_app_candidates('/repo', 'release', 'OmniPot', '1.2.3', true)).toEqual([
            join('/repo', 'release', 'win-unpacked', 'OmniPot.exe'),
            join('/repo', 'release', 'OmniPot1.2.3.exe'),
        ])
    })

    it('produces artifact filenames without spaces', () => {
        const package_json = read_package_json()
        const build = package_json.build!

        expect(build.executableName).not.toMatch(/\s/)
        expect(build.artifactName).toBeDefined()
        expect(build.artifactName).not.toMatch(/\s/)

        const expected_path = app_candidates('/repo', 'release', build.executableName!, '1.0.0', false)
        for (const p of expected_path) {
            expect(p).not.toMatch(/ /)
        }
    })
})
