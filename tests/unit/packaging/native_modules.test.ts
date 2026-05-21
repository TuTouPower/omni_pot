import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT_DIR = join(__dirname, '..', '..', '..')
const PACKAGE_JSON_PATH = join(ROOT_DIR, 'package.json')
const RUN_DIST_PATH = join(ROOT_DIR, 'scripts', 'run_dist.mjs')

type PackageJson = {
    dependencies?: Record<string, string>
    scripts?: Record<string, string>
    build?: {
        asar?: boolean
        asarUnpack?: string[]
        npmRebuild?: boolean
    }
}

function read_package_json(): PackageJson {
    return JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as PackageJson
}

describe('native module packaging', () => {
    it('rebuilds better-sqlite3 for Electron and unpacks native binaries from asar', () => {
        const package_json = read_package_json()

        expect(package_json.dependencies).toHaveProperty('better-sqlite3')
        expect(package_json.scripts?.postinstall).toBe('electron-builder install-app-deps')
        expect(package_json.build?.npmRebuild).toBe(true)
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
        const electron_builder_index = run_dist.search(/\[\s*npx_cmd\s*,\s*\[[\s\S]*?['"]electron-builder['"][\s\S]*?is_dir[\s\S]*?['"]--dir['"][\s\S]*?\]\s*\]/)
        expect(build_step_index).toBeGreaterThanOrEqual(0)
        expect(electron_builder_index).toBeGreaterThan(build_step_index)
    })
})
