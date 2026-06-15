import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo_root = dirname(dirname(fileURLToPath(import.meta.url)))
const package_json = JSON.parse(readFileSync(join(repo_root, 'package.json'), 'utf8'))
const product_name = package_json.build?.productName ?? package_json.name
const executable_name = package_json.build?.executableName ?? product_name
const version = package_json.version
const output_dir = package_json.build?.directories?.output ?? 'dist'
const restart_state_file = join(repo_root, '.claude', 'dist_restart_state.json')
const release_dir = normalize(join(repo_root, output_dir)).toLowerCase()

const is_dir = process.argv.includes('--dir')
const always_start = process.argv.includes('--always')
const install_after_dist = process.argv.includes('--install')

export function should_start_app(platform, always_start, restart_state_exists) {
    return platform === 'win32' && (always_start || restart_state_exists)
}

export function setup_installer_path(repo_root, output_dir, executable_name, version) {
    return join(repo_root, output_dir, `${executable_name}-${version}-windows-setup.exe`)
}

export function app_candidates(repo_root, output_dir, executable_name, version, is_dir) {
    const portable_app = join(repo_root, output_dir, `${executable_name}-${version}-windows-portable.exe`)
    const unpacked_app = join(repo_root, output_dir, 'win-unpacked', `${executable_name}.exe`)
    return is_dir ? [unpacked_app, portable_app] : [portable_app, unpacked_app]
}

export function installed_app_candidates(env, product_name, executable_name) {
    const exe_name = `${executable_name}.exe`
    const dirs = [
        env.ProgramFiles,
        env['ProgramFiles(x86)'],
        env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Programs') : undefined,
    ].filter(Boolean)

    const app_names = Array.from(new Set([product_name, executable_name]))
    const candidates = []
    for (const base_dir of dirs) {
        for (const app_name of app_names) {
            candidates.push(join(base_dir, app_name, exe_name))
            candidates.push(join(base_dir, app_name, executable_name, exe_name))
        }
    }
    return Array.from(new Set(candidates.map((candidate) => normalize(candidate))))
}

function registry_installed_app_candidates(product_name, executable_name) {
    if (process.platform !== 'win32') return []

    const script = String.raw`
$keys = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
Get-ItemProperty -Path $keys -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -like "$env:OMNI_POT_DISPLAY_NAME*" } |
  Select-Object InstallLocation, DisplayIcon |
  ConvertTo-Json -Compress
`
    let raw
    try {
        raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
            encoding: 'utf8',
            env: { ...process.env, OMNI_POT_DISPLAY_NAME: product_name },
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
    const exe_name = `${executable_name}.exe`
    const candidates = []

    for (const row of rows) {
        const install_location = typeof row.InstallLocation === 'string' ? row.InstallLocation.trim() : ''
        const display_icon = typeof row.DisplayIcon === 'string' ? row.DisplayIcon.trim() : ''
        if (install_location) {
            candidates.push(join(install_location, exe_name))
            candidates.push(join(install_location, executable_name, exe_name))
        }
        if (display_icon) {
            candidates.push(display_icon.replace(/,\d+$/, ''))
        }
    }

    return Array.from(new Set(candidates.map((candidate) => normalize(candidate))))
}

function close_existing_installed_processes() {
    if (process.platform !== 'win32') return

    const script = String.raw`
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq $env:OMNI_POT_EXE_NAME } |
  Select-Object ProcessId, ExecutablePath |
  ConvertTo-Json -Compress
`
    let raw
    try {
        raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
            encoding: 'utf8',
            env: { ...process.env, OMNI_POT_EXE_NAME: `${executable_name}.exe` },
        })
    } catch {
        return
    }

    if (!raw.trim()) return

    let parsed
    try {
        parsed = JSON.parse(raw)
    } catch {
        return
    }

    const rows = Array.isArray(parsed) ? parsed : [parsed]
    for (const row of rows) {
        const pid = Number(row.ProcessId)
        const executable_path = typeof row.ExecutablePath === 'string' ? normalize(row.ExecutablePath).toLowerCase() : ''
        if (!pid || !executable_path || executable_path.startsWith(release_dir)) continue
        spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Stop-Process -Id ${String(pid)} -Force`], {
            stdio: 'ignore',
        })
    }
}

function find_existing(candidates) {
    return candidates.find((candidate) => existsSync(candidate))
}

function launch_app(app_path) {
    const child = spawn(app_path, [], {
        detached: true,
        stdio: 'ignore',
    })
    child.unref()
    process.stderr.write(`Restarted Omni Pot: ${app_path}\n`)
}

function install_and_find_app() {
    const setup_path = setup_installer_path(repo_root, output_dir, executable_name, version)
    if (!existsSync(setup_path)) return null

    close_existing_installed_processes()

    const install_result = spawnSync(setup_path, ['/S'], {
        stdio: 'inherit',
        timeout: 300_000,
    })
    if (install_result.error || install_result.status !== 0) {
        process.stderr.write(`Omni Pot setup install failed: ${setup_path}\n`)
        return null
    }

    const installed_path = find_existing([
        ...registry_installed_app_candidates(product_name, executable_name),
        ...installed_app_candidates(process.env, product_name, executable_name),
    ])
    return installed_path ?? null
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

    const app_path = !is_dir && install_after_dist
        ? install_and_find_app() ?? find_existing(candidates)
        : find_existing(candidates)
    if (!app_path) {
        process.stderr.write(missing_app_message(always_start))
        process.exit(always_start ? 1 : 0)
    }

    launch_app(app_path)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main()
}
