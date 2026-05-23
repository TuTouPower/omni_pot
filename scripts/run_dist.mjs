import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

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

export function restart_args(is_dir, completed_ok) {
    return ['scripts/restart_dist_app.mjs', ...(is_dir ? ['--dir'] : []), ...(completed_ok ? ['--always'] : [])]
}

function main() {
    let completed_ok = false

    try {
        const steps = [
            [npm_cmd, ['run', 'dist:check-locks']],
            ['node', ['scripts/ensure_node_abi.mjs']],
            [npm_cmd, ['run', 'build:chinese-dict']],
            [npm_cmd, ['run', 'build:cc-cedict']],
            [npm_cmd, ['run', 'build']],
            ['node', ['scripts/ensure_electron_abi.mjs']],
            [npm_cmd, ['run', 'dist:check-locks']],
            [npx_cmd, ['electron-builder', ...(is_dir ? ['--dir'] : []), '-c.win.signAndEditExecutable=false']],
        ]

        completed_ok = steps.every(([command, args]) => run(command, args))
    } finally {
        run('node', restart_args(is_dir, completed_ok))
    }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main()
}
