import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

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

const release_exe_paths = new Set([
    normalize(join(repo_root, output_dir, `${product_name} ${version}.exe`)).toLowerCase(),
    normalize(join(repo_root, output_dir, 'win-unpacked', `${product_name}.exe`)).toLowerCase(),
])

// Returns [{ pid, name, path }] for processes whose executable path lies under
// our release output directory. We never touch processes that merely share the
// product image name from an installed/stable Omni Pot somewhere else.
function release_processes() {
    if (process.platform !== 'win32') return []

    const script = `
$names = $env:OMNI_POT_PROC_NAMES -split ';'
Get-CimInstance Win32_Process |
    Where-Object { $names -contains $_.Name } |
    Select-Object ProcessId, Name, ExecutablePath |
    ConvertTo-Json -Compress
`
    let raw
    try {
        raw = execFileSync('powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', script], {
                encoding: 'utf8',
                env: { ...process.env, OMNI_POT_PROC_NAMES: process_names.join(';') },
            })
    } catch {
        return []
    }

    if (!raw.trim()) return []
    let parsed
    try {
        parsed = JSON.parse(raw)
    } catch {
        return []
    }
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows
        .map((r) => ({
            pid: Number(r.ProcessId),
            name: String(r.Name ?? ''),
            path: r.ExecutablePath ? normalize(String(r.ExecutablePath)).toLowerCase() : '',
        }))
        .filter((r) => r.pid && r.path && release_exe_paths.has(r.path))
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

async function close_release_processes(targets) {
    if (process.platform !== 'win32' || targets.length === 0) return

    let closed_any = false
    // Graceful close first, then escalate to /f only for stragglers.
    for (const t of targets) {
        const result = spawnSync('taskkill', ['/pid', String(t.pid), '/t'], {
            encoding: 'utf8',
            stdio: 'pipe',
        })
        if (result.status === 0) closed_any = true
    }

    // Wait briefly, then force-kill any that ignored the graceful signal.
    await sleep(1500)
    const still_running = release_processes()
    for (const t of still_running) {
        const result = spawnSync('taskkill', ['/pid', String(t.pid), '/t', '/f'], {
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

async function wait_for_unlocked_files(timeout_ms = 10_000) {
    const start = Date.now()
    while (Date.now() - start < timeout_ms) {
        const locked_files = output_files.filter(is_locked)
        if (locked_files.length === 0) return []
        await sleep(500)
    }
    return output_files.filter(is_locked)
}

let locked_files = output_files.filter(is_locked)
let targets = release_processes()
if (targets.length > 0 && locked_files.length > 0) {
    write_error(`Closing release Omni Pot processes before packaging: ${targets.map((t) => `${t.name}#${String(t.pid)}`).join(', ')}`)
    await close_release_processes(targets)
}

targets = release_processes()
locked_files = await wait_for_unlocked_files()

if (targets.length === 0 && locked_files.length === 0) {
    process.exit(0)
}

write_error('Cannot package Omni Pot because existing build outputs are still in use.')

if (targets.length > 0) {
    write_error(`Close the running release app first: ${targets.map((t) => `${t.name}#${String(t.pid)} (${t.path})`).join(', ')}`)
}

for (const file_path of locked_files) {
    write_error(`Locked output file: ${file_path}`)
}

write_error('Close Omni Pot, wait for antivirus/file sync to release the files, then run npm run dist again.')
process.exit(1)
