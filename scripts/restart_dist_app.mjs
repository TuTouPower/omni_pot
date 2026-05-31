import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo_root = dirname(dirname(fileURLToPath(import.meta.url)))
const package_json = JSON.parse(readFileSync(join(repo_root, 'package.json'), 'utf8'))
const product_name = package_json.build?.productName ?? package_json.name
const executable_name = package_json.build?.executableName ?? product_name
const version = package_json.version
const output_dir = package_json.build?.directories?.output ?? 'dist'
const restart_state_file = join(repo_root, '.claude', 'dist_restart_state.json')

const is_dir = process.argv.includes('--dir')
const always_start = process.argv.includes('--always')

export function should_start_app(platform, always_start, restart_state_exists) {
    return platform === 'win32' && (always_start || restart_state_exists)
}

export function app_candidates(repo_root, output_dir, executable_name, version, is_dir) {
    const portable_app = join(repo_root, output_dir, `${executable_name}${version}.exe`)
    const unpacked_app = join(repo_root, output_dir, 'win-unpacked', `${executable_name}.exe`)
    return is_dir ? [unpacked_app, portable_app] : [portable_app, unpacked_app]
}

function missing_app_message(always_start) {
    return always_start
        ? 'No packaged Omni Pot app was found to start after successful dist.\n'
        : 'Omni Pot was closed before packaging, but no packaged app was found to restart.\n'
}

function main() {
    const candidates = app_candidates(repo_root, output_dir, executable_name, version, is_dir)

    if (!should_start_app(process.platform, always_start, existsSync(restart_state_file))) {
        process.exit(0)
    }

    rmSync(restart_state_file, { force: true })

    const app_path = candidates.find((candidate) => existsSync(candidate))
    if (!app_path) {
        process.stderr.write(missing_app_message(always_start))
        process.exit(always_start ? 1 : 0)
    }

    const child = spawn(app_path, [], {
        detached: true,
        stdio: 'ignore',
    })
    child.unref()
    process.stderr.write(`Restarted Omni Pot: ${app_path}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main()
}
