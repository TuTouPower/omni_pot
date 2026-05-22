import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

// Must instantiate Database to trigger native binding load;
// require('better-sqlite3') only loads the JS wrapper.
const check = spawnSync(
    process.execPath,
    ['-e', "new (require('better-sqlite3'))(':memory:').close()"],
    { stdio: 'pipe' }
)

// If Node can load the native binding, it's Node ABI — rebuild for Electron.
// If Node cannot load it, it's already Electron ABI — nothing to do.
if (check.status === 0) {
    process.stderr.write('[abi] better-sqlite3 is Node ABI, switching to Electron ABI...\n')

    // electron-builder install-app-deps uses prebuild-install which may
    // download a Node-ABI prebuilt instead of rebuilding.  Use node-gyp
    // directly with Electron headers to guarantee the correct ABI.
    const electron_pkg = resolve(process.cwd(), 'node_modules/electron/package.json')
    let electron_version
    try {
        electron_version = JSON.parse(readFileSync(electron_pkg, 'utf8')).version
    } catch {
        process.stderr.write('[abi] cannot read Electron version from node_modules/electron\n')
        process.exit(1)
    }

    const npx_cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const better_sqlite3_dir = resolve(process.cwd(), 'node_modules/better-sqlite3')
    const rebuild = spawnSync(
        npx_cmd,
        [
            'node-gyp', 'rebuild', '--release',
            `--target=${electron_version}`,
            '--arch=x64',
            '--dist-url=https://electronjs.org/headers',
            '--build-from-source',
        ],
        { stdio: 'inherit', shell: process.platform === 'win32', cwd: better_sqlite3_dir }
    )
    if (rebuild.status !== 0) {
        process.exit(rebuild.status ?? 1)
    }
    process.stderr.write('[abi] switch complete\n')
}
