import { spawn, spawnSync, execSync } from 'child_process'
import { resolve } from 'path'

const PROJECT_ROOT = resolve(__dirname, '../..')

function check_electron_abi(): boolean {
    const electron_exe: string = require('electron')
    const check = spawnSync(
        electron_exe,
        ['-e', "new (require('better-sqlite3'))(':memory:').close()"],
        { stdio: 'pipe', cwd: PROJECT_ROOT, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
    )
    return check.status === 0
}

async function run(): Promise<void> {
    // Kill leftover Electron processes from previous test runs.
    // Playwright's Electron support on Windows doesn't guarantee process
    // termination, and orphan electron.exe processes can cause segfaults
    // (ACCESS_VIOLATION) or port conflicts in the next run.
    if (process.platform === 'win32') {
        try {
            execSync(
                `powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name='electron.exe'\\" | Where-Object { $_.CommandLine -match 'omni_pot' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
                { timeout: 5000, stdio: 'ignore' }
            )
        } catch { /* no leftover processes or kill failed */ }
    }

    // Rebuild better-sqlite3 for Electron if ABI mismatch
    if (!check_electron_abi()) {
        process.stderr.write('[abi] better-sqlite3 not compatible with Electron, rebuilding...\n')
        const rebuild = spawnSync(
            process.platform === 'win32' ? 'npx.cmd' : 'npx',
            ['electron-rebuild', '-m', 'node_modules/better-sqlite3'],
            { stdio: 'inherit', shell: process.platform === 'win32', cwd: PROJECT_ROOT }
        )
        if (rebuild.status !== 0) {
            throw new Error('better-sqlite3 Electron rebuild failed')
        }
        process.stderr.write('[abi] Electron rebuild complete\n')
    }

    await new Promise<void>((resolve, reject) => {
        const build = spawn('npx', ['electron-vite', 'build', '--outDir', 'out'], {
            cwd: PROJECT_ROOT,
            shell: true,
            stdio: 'inherit',
            env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
        })
        build.on('exit', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`Build failed with code ${String(code)}`))
        })
    })
}

export default run
