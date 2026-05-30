import { spawnSync } from 'node:child_process'
import process from 'node:process'

function check_abi(exec_path: string, env?: Record<string, string | undefined>): boolean {
    const check = spawnSync(
        exec_path,
        ['-e', "new (require('better-sqlite3'))(':memory:').close()"],
        { stdio: 'pipe', env: env ?? process.env }
    )
    return check.status === 0
}

function rebuild_for_electron(): void {
    process.stderr.write('[abi] rebuilding better-sqlite3 for Electron...\n')
    const rebuild = spawnSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['electron-rebuild', '-m', 'node_modules/better-sqlite3'],
        { stdio: 'inherit', shell: process.platform === 'win32' }
    )
    if (rebuild.status !== 0) {
        throw new Error('better-sqlite3 Electron rebuild failed')
    }
    process.stderr.write('[abi] Electron rebuild complete\n')
}

export default function ensureNodeAbi() {
    // Check Node.js ABI
    if (!check_abi(process.execPath)) {
        process.stderr.write('[abi] better-sqlite3 not compatible with Node, rebuilding...\n')
        const rebuild = spawnSync(
            process.platform === 'win32' ? 'npm.cmd' : 'npm',
            ['rebuild', 'better-sqlite3'],
            { stdio: 'inherit', shell: process.platform === 'win32' }
        )
        if (rebuild.status !== 0) {
            throw new Error('better-sqlite3 rebuild failed')
        }
        process.stderr.write('[abi] Node rebuild complete\n')
    }

    // Check Electron ABI (needs ELECTRON_RUN_AS_NODE to use -e flag)
    const electron_exe: string = require('electron')
    if (!check_abi(electron_exe, { ...process.env, ELECTRON_RUN_AS_NODE: '1' })) {
        rebuild_for_electron()
    }
}
