import { spawnSync } from 'node:child_process'
import process from 'node:process'

const use_shell = process.platform === 'win32'
const npm_cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npx_cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const is_dir = process.argv.includes('--dir')

function run(command, args) {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        shell: use_shell,
    })
    if (result.error) throw result.error
    if (result.status !== 0) process.exitCode = result.status ?? 1
    return process.exitCode === undefined
}

try {
    const steps = [
        [npm_cmd, ['run', 'dist:check-locks']],
        [npm_cmd, ['run', 'build:chinese-dict']],
        [npm_cmd, ['run', 'build']],
        [npm_cmd, ['run', 'dist:check-locks']],
        [npx_cmd, ['electron-builder', ...(is_dir ? ['--dir'] : []), '-c.win.signAndEditExecutable=false']],
    ]

    for (const [command, args] of steps) {
        if (!run(command, args)) break
    }
} finally {
    run('node', ['scripts/restart_dist_app.mjs', ...(is_dir ? ['--dir'] : [])])
}
