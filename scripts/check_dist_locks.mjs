import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repo_root = dirname(dirname(fileURLToPath(import.meta.url)))
const package_json = JSON.parse(readFileSync(join(repo_root, 'package.json'), 'utf8'))
const product_name = package_json.build?.productName ?? package_json.name
const version = package_json.version
const output_dir = package_json.build?.directories?.output ?? 'dist'

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

const running = [...new Set(running_processes())]
const locked_files = output_files.filter(is_locked)

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
