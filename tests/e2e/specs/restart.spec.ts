import { test, expect } from '@playwright/test'
import { spawn, execSync, type ChildProcess } from 'child_process'
import { resolve } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer } from 'net'
import http from 'http'
import { randomUUID } from 'crypto'

const PROJECT_ROOT = resolve(__dirname, '../../..')
const MAIN_JS = resolve(PROJECT_ROOT, 'build/app/main/index.js')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ELECTRON_EXE = require('electron') as string

async function get_free_port(): Promise<number> {
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

function kill_pid(pid: number): void {
    try {
        execSync(`powershell -Command "Stop-Process -Id ${String(pid)} -Force -ErrorAction SilentlyContinue"`, { timeout: 5000, stdio: 'ignore' })
    } catch { /* already dead */ }
}

async function kill_process_tree(proc: ChildProcess): Promise<void> {
    if (proc.pid) {
        // Kill process tree via PowerShell to catch detached children
        try {
            execSync(`powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${String(proc.pid)} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { timeout: 5000, stdio: 'ignore' })
        } catch { /* ignore */ }
        kill_pid(proc.pid)
    }
    // Wait and kill again to catch relaunched instances
    await new Promise(r => setTimeout(r, 2000))
    if (proc.pid) kill_pid(proc.pid)
}

async function wait_for_http(port: number, api_token: string, timeout_ms: number): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeout_ms) {
        try {
            await new Promise<void>((resolve, reject) => {
                const req = http.get({
                    hostname: '127.0.0.1',
                    port,
                    path: '/config',
                    headers: { 'X-Omni-Pot-Api-Token': api_token },
                }, (res) => {
                    res.on('data', () => {})
                    res.on('end', () => { if (res.statusCode === 200) resolve(); else reject(new Error('HTTP request failed')) })
                })
                req.on('error', reject)
            })
            return true
        } catch {
            await new Promise(r => setTimeout(r, 500))
        }
    }
    return false
}

async function http_post(port: number, path: string, body: unknown, api_token: string): Promise<unknown> {
    const body_str = JSON.stringify(body)
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': String(Buffer.byteLength(body_str)),
                'X-Omni-Pot-Api-Token': api_token,
            },
        }, (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk: Buffer) => chunks.push(chunk))
            res.on('end', () => {
                try { resolve(JSON.parse(Buffer.concat(chunks).toString())) } catch { resolve(undefined) }
            })
        })
        req.on('error', reject)
        req.write(body_str)
        req.end()
    })
}

function spawn_app(http_port: number, user_data_dir: string, api_token: string): ChildProcess {
    const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        OMNI_POT_E2E: '1',
        OMNI_POT_E2E_TOKEN: api_token,
        OMNI_POT_E2E_REAL_RESTART: '1',
        OMNI_POT_SERVER_PORT: String(http_port),
        OMNI_POT_USER_DATA: user_data_dir,
        OMNI_POT_PRESET_CONFIG: JSON.stringify({
            __initialized: true,
            server_api_token: api_token,
            check_update: false,
            app_language: 'en',
            welcome_dismissed: true,
        }),
    }
    delete env.ELECTRON_RUN_AS_NODE

    return spawn(ELECTRON_EXE, [MAIN_JS], { env, stdio: ['ignore', 'pipe', 'pipe'] })
}

async function wait_for_exit(proc: ChildProcess, timeout_ms: number): Promise<number | null> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => { resolve(null) }, timeout_ms)
        proc.on('exit', (code) => { clearTimeout(timer); resolve(code) })
    })
}

test.describe('restart process lifecycle @core', () => {
    test('restart triggers process exit, shutdown, and relaunch', async () => {
        const port = await get_free_port()
        const user_data_dir = mkdtempSync(join(tmpdir(), 'omni_pot-restart-'))
        const api_token = randomUUID()

        const proc = spawn_app(port, user_data_dir, api_token)

        try {
            const ready = await wait_for_http(port, api_token, 30_000)
            expect(ready, 'app HTTP server should start').toBe(true)

            const result = await http_post(port, '/e2e/tray-action', { action: 'restart' }, api_token)
            expect(result).toEqual({ success: true, action: 'restart' })

            const code = await wait_for_exit(proc, 15_000)
            expect(code, 'process should exit after restart').toBe(0)

            // New instance spawns on the same port, so we can't assert the port is free.
            // The exit code 0 above already proves the old process shut down cleanly.
            const relaunched = await wait_for_http(port, api_token, 30_000)
            expect(relaunched, 'new instance should start after restart').toBe(true)
        } finally {
            await kill_process_tree(proc)
            try { rmSync(user_data_dir, { recursive: true, force: true }) } catch { /* ignore */ }
        }
    })
})
