import { spawn, execSync, type ChildProcess } from 'child_process'
import { resolve } from 'path'
import { createServer } from 'net'
import http from 'http'
import { type GlobalSetupContext } from 'vitest/node'

const CDP_PORT = 9225
const HTTP_PORT = 20202
const PROJECT_ROOT = resolve(__dirname, '../..')
const ELECTRON_BIN = resolve(PROJECT_ROOT, 'node_modules/electron/dist/electron.exe')
const MAIN_JS = resolve(PROJECT_ROOT, 'out/main/index.js')

let electronProcess: ChildProcess | null = null

function killExistingElectron(): void {
    try {
        execSync('taskkill //F //IM electron.exe 2>nul', { stdio: 'ignore' })
    } catch { /* no process found */ }
    // Also kill any process holding our HTTP port
    try {
        const netstat = execSync('netstat -ano', { encoding: 'utf-8' })
        for (const line of netstat.split('\n')) {
            if (line.includes(`:${HTTP_PORT}`) && line.includes('LISTENING')) {
                const pid = line.trim().split(/\s+/).pop()
                if (pid && pid !== '0') {
                    console.log(`[e2e-setup] Killing PID ${pid} holding port ${HTTP_PORT}`)
                    try { execSync(`taskkill //F //PID ${pid} 2>nul`, { stdio: 'ignore' }) } catch { /* already dead */ }
                }
            }
        }
    } catch { /* netstat failed */ }
}

/** Probe a port by actually trying to bind it — more reliable than HTTP GET */
async function isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const srv = createServer()
        srv.once('listening', () => { srv.close(); resolve(true) })
        srv.once('error', () => resolve(false))
        srv.listen(port, '127.0.0.1')
    })
}

async function waitForPortFree(port: number, timeoutMs = 15000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        if (await isPortFree(port)) return
        await new Promise(r => setTimeout(r, 500))
    }
    throw new Error(`Port ${port} not free after ${timeoutMs}ms`)
}

async function waitForCdp(timeoutMs = 20000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        try {
            await new Promise<void>((resolve, reject) => {
                http.get(`http://localhost:${CDP_PORT}/json`, (res) => {
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
    throw new Error(`CDP not ready after ${timeoutMs}ms`)
}

async function waitForHttpServer(timeoutMs = 20000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        try {
            await new Promise<void>((resolve, reject) => {
                http.get(`http://127.0.0.1:${HTTP_PORT}/config`, (res) => {
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
    throw new Error(`HTTP server not ready after ${timeoutMs}ms`)
}

export async function setup({ provide }: GlobalSetupContext): Promise<void> {
    console.log('[e2e-setup] Cleaning up existing processes...')
    killExistingElectron()
    // Windows needs time to release sockets after process kill
    await new Promise(r => setTimeout(r, 3000))
    await waitForPortFree(HTTP_PORT)
    await waitForPortFree(CDP_PORT)

    console.log('[e2e-setup] Building main process...')

    // Build main process
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

    console.log('[e2e-setup] Starting Electron app...')

    // Start Electron with clean environment
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE

    electronProcess = spawn(ELECTRON_BIN, [MAIN_JS, `--remote-debugging-port=${CDP_PORT}`], {
        cwd: PROJECT_ROOT,
        env,
        stdio: 'pipe'
    })

    electronProcess.stdout?.on('data', (d: Buffer) => {
        const msg = d.toString().trim()
        if (msg) console.log('[electron]', msg)
    })
    electronProcess.stderr?.on('data', (d: Buffer) => {
        const msg = d.toString().trim()
        if (msg) console.error('[electron:err]', msg)
    })
    electronProcess.on('exit', (code) => {
        console.log('[e2e-setup] Electron exited with code', code)
        electronProcess = null
    })

    console.log('[e2e-setup] Waiting for CDP...')
    await waitForCdp()
    console.log('[e2e-setup] CDP ready')

    console.log('[e2e-setup] Waiting for HTTP server...')
    await waitForHttpServer()
    console.log('[e2e-setup] HTTP server ready')

    provide('cdpPort', CDP_PORT)
    provide('httpPort', HTTP_PORT)
}

export async function teardown(): Promise<void> {
    console.log('[e2e-teardown] Shutting down Electron...')
    if (electronProcess && !electronProcess.killed) {
        electronProcess.kill('SIGTERM')
        // Wait up to 5s for graceful shutdown
        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                if (electronProcess && !electronProcess.killed) {
                    electronProcess.kill('SIGKILL')
                }
                resolve()
            }, 5000)
            electronProcess.on('exit', () => {
                clearTimeout(timeout)
                resolve()
            })
        })
    }
    console.log('[e2e-teardown] Done')
}

declare module 'vitest' {
    export interface ProvidedContext {
        cdpPort: number
        httpPort: number
    }
}
