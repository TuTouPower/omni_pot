import { spawnSync } from 'node:child_process'
import process from 'node:process'

function check_abi(exec_path: string): boolean {
    const check = spawnSync(
        exec_path,
        ['-e', "new (require('better-sqlite3'))(':memory:').close()"],
        { stdio: 'pipe', env: process.env }
    )
    return check.status === 0
}

export default function ensureNodeAbi() {
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
}
