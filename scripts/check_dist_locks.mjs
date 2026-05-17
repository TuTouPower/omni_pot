import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repo_root = dirname(dirname(fileURLToPath(import.meta.url)))
const package_json = JSON.parse(readFileSync(join(repo_root, 'package.json'), 'utf8'))
const product_name = package_json.build?.productName ?? package_json.name
const version = package_json.version
const output_dir = package_json.build?.directories?.output ?? 'dist'
const restart_state_dir = join(repo_root, '.claude')
const restart_state_file = join(restart_state_dir, 'dist_restart_state.json')

const process_names = [
    `${product_name}.exe`,
    `${product_name} ${version}.exe`,
]

const output_files = [
    join(repo_root, output_dir, `${product_name} ${version}.exe`),
    join(repo_root, output_dir, `${product_name} Setup ${version}.exe`),
    join(repo_root, output_dir, 'win-unpacked', `${product_name}.exe`),
]

function running_processes() {
    if (process.platform !== 'win32') return []

    try {
        const output = execFileSync('tasklist', ['/fo', 'csv', '/nh'], { encoding: 'utf8' })
        return output
            .split(/\r?\n/)
            .map((line) => line.match(/^"([^"]+)"/u)?.[1])
            .filter((name) => name && process_names.includes(name))
    } catch {
        return []
    }
}

function is_locked(file_path) {
    if (!existsSync(file_path)) return false
    if (process.platform !== 'win32') return false

    const script = `
$path = $env:DIST_LOCK_FILE
try {
    $stream = [System.IO.File]::Open($path, 'Open', 'ReadWrite', 'None')
    $stream.Close()
    exit 0
} catch {
    exit 1
}
`
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        env: { ...process.env, DIST_LOCK_FILE: file_path },
        stdio: 'ignore',
    })
    return result.status !== 0
}

function write_error(message) {
    process.stderr.write(`${message}\n`)
}

function close_running_processes(running) {
    if (process.platform !== 'win32') return

    let closed_any = false
    for (const name of running) {
        const result = spawnSync('taskkill', ['/im', name, '/t', '/f'], {
            encoding: 'utf8',
            stdio: 'pipe',
        })
        if (result.status === 0) {
            closed_any = true
        } else if (result.stderr) {
            write_error(result.stderr.trim())
        }
    }

    if (closed_any) {
        mkdirSync(restart_state_dir, { recursive: true })
        writeFileSync(restart_state_file, JSON.stringify({ closed: true }, null, 2), 'utf8')
    }
}

function wait_for_unlocked_files(timeout_ms = 10_000) {
    const start = Date.now()
    while (Date.now() - start < timeout_ms) {
        const locked_files = output_files.filter(is_locked)
        if (locked_files.length === 0) return []
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
    }
    return output_files.filter(is_locked)
}

let locked_files = output_files.filter(is_locked)
let running = [...new Set(running_processes())]
if (running.length > 0 && locked_files.length > 0) {
    write_error(`Closing running Omni Pot app before packaging: ${running.join(', ')}`)
    close_running_processes(running)
}

running = [...new Set(running_processes())]
locked_files = wait_for_unlocked_files()

if (running.length === 0 && locked_files.length === 0) {
    process.exit(0)
}

write_error('Cannot package Omni Pot because existing build outputs are still in use.')

if (running.length > 0) {
    write_error(`Close the running app first: ${running.join(', ')}`)
}

for (const file_path of locked_files) {
    write_error(`Locked output file: ${file_path}`)
}

write_error('Close Omni Pot, wait for antivirus/file sync to release the files, then run npm run dist again.')
process.exit(1)
