import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repo_root = dirname(dirname(fileURLToPath(import.meta.url)))
const package_json = JSON.parse(readFileSync(join(repo_root, 'package.json'), 'utf8'))
const product_name = package_json.build?.productName ?? package_json.name
const version = package_json.version
const output_dir = package_json.build?.directories?.output ?? 'dist'
const restart_state_file = join(repo_root, '.claude', 'dist_restart_state.json')

const is_dir = process.argv.includes('--dir')
const portable_app = join(repo_root, output_dir, `${product_name} ${version}.exe`)
const unpacked_app = join(repo_root, output_dir, 'win-unpacked', `${product_name}.exe`)
const app_candidates = is_dir ? [unpacked_app, portable_app] : [portable_app, unpacked_app]

if (process.platform !== 'win32' || !existsSync(restart_state_file)) {
    process.exit(0)
}

rmSync(restart_state_file, { force: true })

const app_path = app_candidates.find((candidate) => existsSync(candidate))
if (!app_path) {
    process.stderr.write('Omni Pot was closed before packaging, but no packaged app was found to restart.\n')
    process.exit(0)
}

const child = spawn(app_path, [], {
    detached: true,
    stdio: 'ignore',
})
child.unref()
process.stderr.write(`Restarted Omni Pot: ${app_path}\n`)
