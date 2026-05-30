import { _electron as electron, type ElectronApplication } from '@playwright/test'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir, platform } from 'os'
import { join } from 'path'
import http from 'http'
import { createServer } from 'net'
import { randomUUID } from 'crypto'

const PROJECT_ROOT = resolve(__dirname, '../../..')
const MAIN_JS = resolve(PROJECT_ROOT, 'out/main/index.js')

async function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = createServer()
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address()
            if (typeof addr === 'object' && addr) resolve(addr.port)
            else reject(new Error('Failed to get free port'))
            srv.close()
        })
    })
}

async function waitForHttpServer(port: number, e2eToken: string, timeoutMs = 25_000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        try {
            await new Promise<void>((resolve, reject) => {
                const req = http.get({
                    hostname: '127.0.0.1',
                    port,
                    path: '/config',
                    headers: { 'X-Omni-Pot-E2E-Token': e2eToken },
                }, (res) => {
                    res.on('data', () => {})
                    res.on('end', () => {
                        if (res.statusCode === 200) resolve()
                        else reject(new Error(`status ${String(res.statusCode)}`))
                    })
                })
                req.on('error', reject)
            })
            return
        } catch {
            await new Promise(r => setTimeout(r, 500))
        }
    }
    throw new Error(`HTTP server not ready on port ${String(port)} after ${String(timeoutMs)}ms`)
}

export interface LaunchedApp {
    app: ElectronApplication
    httpPort: number
    userDataDir: string
    e2eToken: string
    cleanupUserDataDir: boolean
}

export async function launchApp(opts: {
    config?: Record<string, unknown>
    firstRun?: boolean
    userDataDir?: string
    cleanupUserDataDir?: boolean
} = {}): Promise<LaunchedApp> {
    const httpPort = await getFreePort()
    const userDataDir = opts.userDataDir ?? mkdtempSync(join(tmpdir(), 'omni_pot-e2e-'))
    const cleanupUserDataDir = opts.cleanupUserDataDir ?? !opts.userDataDir
    const e2eToken = randomUUID()

    const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        OMNI_POT_E2E: '1',
        OMNI_POT_E2E_TOKEN: e2eToken,
        OMNI_POT_SERVER_PORT: String(httpPort),
        OMNI_POT_USER_DATA: userDataDir,
    }
    delete env.ELECTRON_RUN_AS_NODE

    const shouldPresetConfig = opts.firstRun || opts.config !== undefined || opts.userDataDir === undefined
    const presetConfig = opts.firstRun ? opts.config : { __initialized: true, welcome_dismissed: true, ...(opts.config ?? {}) }
    if (shouldPresetConfig && presetConfig) {
        env.OMNI_POT_PRESET_CONFIG = JSON.stringify(presetConfig)
    }
    if (opts.firstRun) {
        env.OMNI_POT_FIRST_RUN = '1'
    }

    const app = await electron.launch({
        args: [MAIN_JS],
        env,
    })

    await waitForHttpServer(httpPort, e2eToken)

    return { app, httpPort, userDataDir, e2eToken, cleanupUserDataDir }
}

export async function closeApp(launched: LaunchedApp): Promise<void> {
    const proc = launched.app.process()
    const pid = proc?.pid

    await launched.app.close()

    // Playwright's close() on Windows doesn't guarantee process termination.
    // The app's empty window-all-closed handler prevents Electron from self-quitting,
    // and Playwright's TerminateProcess may not trigger graceful shutdown.
    // Force-kill the process tree to ensure clean isolation between tests.
    if (pid) {
        await new Promise(r => setTimeout(r, 500))
        if (platform() === 'win32') {
            try {
                execSync(`taskkill /F /T /PID ${pid} 2>nul`, { timeout: 3000, stdio: 'ignore' })
            } catch { /* process already exited */ }
        } else {
            try { process.kill(pid, 'SIGKILL') } catch { /* already exited */ }
        }
    }

    // Delay cleanup to let the OS release file handles (config writes, DB flush).
    await new Promise(r => setTimeout(r, 300))
    if (launched.cleanupUserDataDir) {
        try {
            rmSync(launched.userDataDir, { recursive: true, force: true })
        } catch { /* ignore cleanup errors */ }
    }
}
