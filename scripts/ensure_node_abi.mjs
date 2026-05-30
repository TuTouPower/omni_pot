import { spawnSync } from 'node:child_process'
import process from 'node:process'

function check_abi(exec_path, label) {
    const check = spawnSync(
        exec_path,
        ['-e', "new (require('better-sqlite3'))(':memory:').close()"],
        { stdio: 'pipe' }
    )
    return check.status === 0
}

function rebuild_for_electron() {
    process.stderr.write('[abi] rebuilding better-sqlite3 for Electron...\n')
    const rebuild = spawnSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['electron-rebuild', '-m', 'node_modules/better-sqlite3'],
        { stdio: 'inherit', shell: process.platform === 'win32' }
    )
    if (rebuild.status !== 0) {
        process.exit(rebuild.status ?? 1)
    }
    process.stderr.write('[abi] Electron rebuild complete\n')
}

// Check Node.js ABI
if (!check_abi(process.execPath, 'Node')) {
    process.stderr.write('[abi] better-sqlite3 not compatible with Node, rebuilding...\n')
    const rebuild = spawnSync(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['rebuild', 'better-sqlite3'],
        { stdio: 'inherit', shell: process.platform === 'win32' }
    )
    if (rebuild.status !== 0) {
        process.exit(rebuild.status ?? 1)
    }
    process.stderr.write('[abi] Node rebuild complete\n')
}

// Check Electron ABI
const electron_exe = require('electron')
if (!check_abi(electron_exe, 'Electron')) {
    rebuild_for_electron()
}
