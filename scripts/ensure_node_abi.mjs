import { spawnSync } from 'node:child_process'
import process from 'node:process'

// Must instantiate Database to trigger native binding load;
// require('better-sqlite3') only loads the JS wrapper.
const check = spawnSync(
    process.execPath,
    ['-e', "new (require('better-sqlite3'))(':memory:').close()"],
    { stdio: 'pipe' }
)

if (check.status !== 0) {
    process.stderr.write('[abi] better-sqlite3 not compatible with Node, rebuilding...\n')
    const rebuild = spawnSync(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['rebuild', 'better-sqlite3'],
        { stdio: 'inherit', shell: process.platform === 'win32' }
    )
    if (rebuild.status !== 0) {
        process.exit(rebuild.status ?? 1)
    }
    process.stderr.write('[abi] rebuild complete\n')
}
