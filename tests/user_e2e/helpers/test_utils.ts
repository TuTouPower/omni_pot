import type { CdpClient } from './cdp_helper'

// --- Per-instance state (set via init()) ---

let _client: CdpClient | null = null
let _httpPort: number = 0

/** Initialize helpers with a specific CDP client and HTTP port */
export function init(client: CdpClient, httpPort: number): void {
    _client = client
    _httpPort = httpPort
}

export function cleanup(): void {
    _client?.close()
    _client = null
    _httpPort = 0
}

function getClient(): CdpClient {
    if (!_client) throw new Error('test_utils not initialized — call init(client, httpPort) in beforeAll')
    return _client
}

// --- DOM helpers ---

/** Wait until a CSS selector matches at least one element in the page */
export async function waitForSelector(selector: string, timeoutMs = 10000): Promise<void> {
    const c = getClient()
    await c.waitFor(
        async () => {
            const count = await c.evaluate(`document.querySelectorAll("${selector}").length`) as number
            return count > 0
        },
        timeoutMs
    )
}

// --- Translate helpers ---

export async function clearTextarea(): Promise<void> {
    const c = getClient()
    // Focus textarea
    await c.evaluate('document.querySelector("textarea")?.focus()')
    // Select all (Ctrl+A)
    await c.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'a', code: 'KeyA',
        windowsVirtualKeyCode: 65, modifiers: 2
    })
    await c.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'a', code: 'KeyA',
        windowsVirtualKeyCode: 65, modifiers: 2
    })
    // Delete selection
    await c.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Delete', code: 'Delete',
        windowsVirtualKeyCode: 46
    })
    await c.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Delete', code: 'Delete',
        windowsVirtualKeyCode: 46
    })
}

export async function getTextareaValue(): Promise<string> {
    const c = getClient()
    return (await c.evaluate('document.querySelector("textarea")?.value ?? ""')) as string
}

/** Read a config key from the translate window's electronAPI */
export async function readConfig(key: string): Promise<unknown> {
    const c = getClient()
    return c.evaluate(`window.electronAPI.config.get('${key}')`)
}

/** Write a config key via the translate window's electronAPI */
export async function writeConfig(key: string, value: unknown): Promise<void> {
    const c = getClient()
    await c.evaluate(`window.electronAPI.config.set('${key}', ${JSON.stringify(value)})`)
}

/** Trigger translate via HTTP API */
export async function triggerTranslateViaApi(text: string): Promise<void> {
    const http = await import('http')
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: _httpPort,
            path: '/translate',
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' }
        }, (res) => {
            res.resume()
            res.on('end', resolve)
        })
        req.on('error', reject)
        req.write(text)
        req.end()
    })
}

/** Trigger selection translate via E2E HTTP endpoint with optional text injection */
export async function triggerSelectionTranslate(text?: string): Promise<{ success: boolean; method?: string; reason?: string }> {
    const http = await import('http')
    return new Promise((resolve, reject) => {
        const body = text ? JSON.stringify({ text }) : ''
        const req = http.request({
            hostname: '127.0.0.1',
            port: _httpPort,
            path: '/trigger-selection',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(body ? { 'Content-Length': String(body.length) } : {})
            }
        }, (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk: Buffer) => chunks.push(chunk))
            res.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString()))
                } catch {
                    resolve({ success: false })
                }
            })
        })
        req.on('error', reject)
        if (body) req.write(body)
        req.end()
    })
}

/** Trigger dict lookup via E2E HTTP endpoint */
export async function triggerDictLookup(text: string): Promise<{ success: boolean; error?: string }> {
    const http = await import('http')
    const body = JSON.stringify({ text })
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: _httpPort,
            path: '/trigger-dict',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': String(body.length) }
        }, (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk: Buffer) => chunks.push(chunk))
            res.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString()))
                } catch {
                    resolve({ success: false })
                }
            })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
    })
}

/** Write text to system clipboard via E2E HTTP endpoint (clipboard monitor will pick it up) */
export async function triggerClipboardText(text: string): Promise<{ success: boolean; error?: string }> {
    const http = await import('http')
    const body = JSON.stringify({ text })
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: _httpPort,
            path: '/trigger-clipboard',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': String(body.length) }
        }, (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk: Buffer) => chunks.push(chunk))
            res.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString()))
                } catch {
                    resolve({ success: false })
                }
            })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
    })
}

/** Wait until the translate results area has at least N result cards */
export async function waitForResults(minCount: number, timeoutMs = 15000): Promise<void> {
    const c = getClient()
    await c.waitFor(
        async () => {
            const count = await c.evaluate(`
                document.querySelectorAll('[data-result-key]').length
            `) as number
            return count >= minCount
        },
        timeoutMs
    )
}

/** Wait until source text in translate window matches expected value */
export async function waitForSourceText(expected: string, timeoutMs = 5000): Promise<void> {
    const c = getClient()
    let lastVal = ''
    await c.waitFor(
        async () => {
            lastVal = await getTextareaValue()
            return lastVal === expected
        },
        timeoutMs
    ).catch(() => {
        throw new Error(`waitForSourceText: expected ${JSON.stringify(expected)}, got ${JSON.stringify(lastVal)}`)
    })
}

// Backward compat
export function getTranslateClient(): CdpClient {
    return getClient()
}
