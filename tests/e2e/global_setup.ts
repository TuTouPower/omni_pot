import { spawn, spawnSync, execSync } from 'child_process'
import { resolve } from 'path'
import { existsSync } from 'fs'

const PROJECT_ROOT = resolve(__dirname, '../..')

function ensure_electron_abi(): void {
    const ensure = spawnSync(
        process.execPath,
        ['scripts/ensure_electron_abi.mjs'],
        { stdio: 'inherit', cwd: PROJECT_ROOT }
    )
    if (ensure.status !== 0) {
        throw new Error('better-sqlite3 Electron ABI setup failed')
    }
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

    ensure_electron_abi()

    // Skip rebuild when developer is iterating locally and build/app/ is already up-to-date.
    // Set OMNI_POT_E2E_SKIP_BUILD=1 to reuse the existing build/app/ build.
    if (process.env.OMNI_POT_E2E_SKIP_BUILD === '1' && existsSync(resolve(PROJECT_ROOT, 'build/app/main/index.js'))) {
        process.stderr.write('[setup] OMNI_POT_E2E_SKIP_BUILD=1, reusing existing build/app/\n')
        return
    }

    await new Promise<void>((resolve, reject) => {
        const build = spawn('npx', ['electron-vite', 'build', '--outDir', 'build/app'], {
            cwd: PROJECT_ROOT,
            shell: true,
            stdio: 'inherit',
            env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
        })
        build.on('exit', (code) => {
            if (code === 0) {
                ensure_electron_abi()
                resolve()
            } else {
                reject(new Error(`Build failed with code ${String(code)}`))
            }
        })
    })
}

export default run
