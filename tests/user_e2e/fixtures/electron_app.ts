import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { resolve } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
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

async function waitForHttpServer(port: number, timeoutMs = 25_000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        try {
            await new Promise<void>((resolve, reject) => {
                http.get(`http://127.0.0.1:${port}/config`, (res) => {
                    let data = ''
                    res.on('data', (c: Buffer) => data += c)
                    res.on('end', () => {
                        if (res.statusCode === 200) resolve()
                        else reject(new Error(`status ${res.statusCode}`))
                    })
                }).on('error', reject)
            })
            return
        } catch {
            await new Promise(r => setTimeout(r, 500))
        }
    }
    throw new Error(`HTTP server not ready on port ${port} after ${timeoutMs}ms`)
}

export interface LaunchedApp {
    app: ElectronApplication
    httpPort: number
    userDataDir: string
    e2eToken: string
}

export async function launchApp(opts: {
    config?: Record<string, unknown>
    firstRun?: boolean
} = {}): Promise<LaunchedApp> {
    const httpPort = await getFreePort()
    const userDataDir = mkdtempSync(join(tmpdir(), 'omni-pot-e2e-'))
    const e2eToken = randomUUID()

    const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        OMNI_POT_E2E: '1',
        OMNI_POT_E2E_TOKEN: e2eToken,
        OMNI_POT_SERVER_PORT: String(httpPort),
        OMNI_POT_USER_DATA: userDataDir,
    }
    delete env.ELECTRON_RUN_AS_NODE

    const presetConfig = opts.firstRun ? opts.config : { __initialized: true, ...opts.config }
    if (presetConfig) {
        env.OMNI_POT_PRESET_CONFIG = JSON.stringify(presetConfig)
    }
    if (opts.firstRun) {
        env.OMNI_POT_FIRST_RUN = '1'
    }

    const app = await electron.launch({
        args: [MAIN_JS],
        env,
    })

    await waitForHttpServer(httpPort)

    return { app, httpPort, userDataDir, e2eToken }
}

export async function closeApp(launched: LaunchedApp): Promise<void> {
    await launched.app.close()
    try {
        rmSync(launched.userDataDir, { recursive: true, force: true })
    } catch { /* ignore cleanup errors */ }
}
