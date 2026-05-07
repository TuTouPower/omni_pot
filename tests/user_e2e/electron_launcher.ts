import { spawn, execSync, type ChildProcess } from 'child_process'
import { resolve } from 'path'
import { createServer } from 'net'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import http from 'http'
import { CdpClient } from './cdp_helper'

const PROJECT_ROOT = resolve(__dirname, '../..')
const ELECTRON_BIN = resolve(PROJECT_ROOT, 'node_modules/electron/dist/electron.exe')
const MAIN_JS = resolve(PROJECT_ROOT, 'out/main/index.js')
const LOCK_DIR = resolve(PROJECT_ROOT, 'node_modules/.e2e-build-lock')

/** Get a random free port from the OS */
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

async function isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const srv = createServer()
        srv.once('listening', () => { srv.close(); resolve(true) })
        srv.once('error', () => resolve(false))
        srv.listen(port, '127.0.0.1')
    })
}

async function waitForPortFree(port: number, timeoutMs = 10000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        if (await isPortFree(port)) return
        await new Promise(r => setTimeout(r, 500))
    }
    throw new Error(`Port ${port} not free after ${timeoutMs}ms`)
}

async function waitForCdp(port: number, timeoutMs = 25000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        try {
            await new Promise<void>((resolve, reject) => {
                http.get(`http://localhost:${port}/json`, (res) => {
                    let data = ''
                    res.on('data', (c: Buffer) => data += c)
                    res.on('end', () => {
                        try {
                            const targets = JSON.parse(data) as Array<{ url: string }>
                            const translate = targets.find(t => t.url.includes('translate'))
                            if (translate) resolve()
                            else reject(new Error('translate target not ready'))
                        } catch { reject(new Error('invalid JSON')) }
                    })
                }).on('error', reject)
            })
            return
        } catch {
            await new Promise(r => setTimeout(r, 500))
        }
    }
    throw new Error(`CDP not ready on port ${port} after ${timeoutMs}ms`)
}

async function waitForHttpServer(port: number, timeoutMs = 25000): Promise<void> {
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

export interface ElectronInstance {
    process: ChildProcess
    cdpPort: number
    httpPort: number
    translateClient: CdpClient
}

/**
 * Build the Electron app (shared across all test files).
 * Uses a file lock so only one fork builds; others wait.
 */
export async function ensureBuilt(): Promise<void> {
    const lockFile = resolve(LOCK_DIR, 'done')
    const buildingFile = resolve(LOCK_DIR, 'building')

    // Already built
    if (existsSync(lockFile)) return

    // Try to become the builder
    try {
        if (!existsSync(LOCK_DIR)) mkdirSync(LOCK_DIR, { recursive: true })
        writeFileSync(buildingFile, String(process.pid), { flag: 'wx' })
    } catch {
        // Another process is building — wait for it
        const start = Date.now()
        while (!existsSync(lockFile) && Date.now() - start < 120000) {
            await new Promise(r => setTimeout(r, 1000))
        }
        if (!existsSync(lockFile)) throw new Error('Build wait timeout')
        return
    }

    console.log('[launcher] Building main process...')
    await new Promise<void>((resolve, reject) => {
        const build = spawn('npx', ['electron-vite', 'build', '--outDir', 'out'], {
            cwd: PROJECT_ROOT,
            shell: true,
            stdio: 'pipe',
            env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
        })
        build.on('exit', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`build failed with code ${code}`))
        })
    })
    writeFileSync(lockFile, 'done')
    console.log('[launcher] Build complete')
}

/**
 * Start a fresh Electron instance with unique ports.
 * Each test file should call this in beforeAll.
 */
export async function startElectron(): Promise<ElectronInstance> {
    const cdpPort = await getFreePort()
    const httpPort = await getFreePort()
    console.log('[launcher] Starting Electron (CDP:%d, HTTP:%d)...', cdpPort, httpPort)

    // Kill anything on these ports
    for (const port of [cdpPort, httpPort]) {
        if (!(await isPortFree(port))) {
            try {
                const netstat = execSync('netstat -ano', { encoding: 'utf-8' })
                for (const line of netstat.split('\n')) {
                    if (line.includes(`:${port}`) && line.includes('LISTENING')) {
                        const pid = line.trim().split(/\s+/).pop()
                        if (pid && pid !== '0') {
                            execSync(`taskkill //F //PID ${pid} 2>nul`, { stdio: 'ignore' })
                        }
                    }
                }
            } catch { /* ignore */ }
            await new Promise(r => setTimeout(r, 1000))
        }
    }

    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    env['OMNI_POT_SERVER_PORT'] = String(httpPort)
    env['OMNI_POT_E2E'] = '1'

    const electronProcess = spawn(ELECTRON_BIN, [
        MAIN_JS,
        `--remote-debugging-port=${cdpPort}`
    ], {
        cwd: PROJECT_ROOT,
        env,
        stdio: 'pipe'
    })

    electronProcess.stdout?.on('data', (d: Buffer) => {
        const msg = d.toString().trim()
        if (msg) console.log('[electron:%d]', cdpPort, msg)
    })
    electronProcess.stderr?.on('data', (d: Buffer) => {
        const msg = d.toString().trim()
        // Filter out noisy security warnings
        if (msg && !msg.includes('Security Warning') && !msg.includes('console-message')) {
            console.error('[electron:%d:err]', cdpPort, msg)
        }
    })

    // Wait for CDP and HTTP server
    await waitForCdp(cdpPort)
    console.log('[launcher] CDP ready on port %d', cdpPort)

    await waitForHttpServer(httpPort)
    console.log('[launcher] HTTP server ready on port %d', httpPort)

    // Connect translate window CDP client
    const target = await findTranslateTarget(cdpPort)
    const translateClient = await CdpClient.connect(target.wsUrl)

    return { process: electronProcess, cdpPort, httpPort, translateClient }
}

/**
 * Stop an Electron instance.
 */
export async function stopElectron(instance: ElectronInstance | undefined): Promise<void> {
    if (!instance) return
    console.log('[launcher] Stopping Electron (CDP:%d)...', instance.cdpPort)
    instance.translateClient.close()

    if (instance.process && !instance.process.killed) {
        instance.process.kill('SIGTERM')
        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                if (instance.process && !instance.process.killed) {
                    instance.process.kill('SIGKILL')
                }
                resolve()
            }, 5000)
            instance.process.on('exit', () => {
                clearTimeout(timeout)
                resolve()
            })
        })
    }
    console.log('[launcher] Electron stopped (CDP:%d)', instance.cdpPort)
}

// Re-export findTranslateTarget for convenience
async function findTranslateTarget(port: number): Promise<{ wsUrl: string }> {
    const targets = await new Promise<Array<{ url: string; webSocketDebuggerUrl: string }>>((resolve, reject) => {
        http.get(`http://localhost:${port}/json`, (res) => {
            let data = ''
            res.on('data', (c: Buffer) => data += c)
            res.on('end', () => resolve(JSON.parse(data)))
        }).on('error', reject)
    })
    const t = targets.find(t => t.url.includes('translate'))
    if (!t) throw new Error(`No translate target found on CDP port ${port}`)
    return { wsUrl: t.webSocketDebuggerUrl }
}
