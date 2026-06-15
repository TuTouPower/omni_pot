import { spawnSync, execSync } from 'node:child_process'
import process from 'node:process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sqlite_check_script = "new (require('better-sqlite3'))(':memory:').close()"

// Must instantiate Database to trigger native binding load;
// require('better-sqlite3') only loads the JS wrapper.
const electron_check = spawnSync(
    require('electron'),
    ['-e', sqlite_check_script],
    { stdio: 'pipe', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
)

if (electron_check.status !== 0) {
    process.stderr.write('[abi] better-sqlite3 is not compatible with Electron, rebuilding...\n')

    const npx_cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const target_arch = process.env['npm_config_arch'] ?? process.arch
    const rebuild = spawnSync(
        npx_cmd,
        ['electron-rebuild', '-f', '-w', 'better-sqlite3', '--build-from-source', `--arch=${target_arch}`],
        { stdio: 'inherit', shell: process.platform === 'win32' }
    )
    if (rebuild.status !== 0) {
        process.exit(rebuild.status ?? 1)
    }

    if (process.platform === 'win32') {
        try {
            execSync(
                `powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name='electron.exe'\\" | Where-Object { $_.CommandLine -match 'omni_pot' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
                { timeout: 5000, stdio: 'ignore' }
            )
        } catch { /* no leftover processes */ }
        spawnSync('ping', ['-n', '2', '127.0.0.1'], { stdio: 'ignore' })
    }

    process.stderr.write('[abi] switch complete\n')
}
