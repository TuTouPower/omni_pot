import WebSocket from 'ws'

interface CdpResponse {
    id?: number
    result?: { result?: { value?: unknown } }
    error?: { message: string }
}

export class CdpClient {
    private ws: WebSocket
    private msgId = 0
    private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

    private constructor(ws: WebSocket) {
        this.ws = ws
        ws.on('message', (raw: Buffer) => {
            const msg = JSON.parse(raw.toString()) as CdpResponse
            if (msg.id !== undefined) {
                const p = this.pending.get(msg.id)
                if (p) {
                    this.pending.delete(msg.id)
                    if (msg.error) p.reject(new Error(msg.error.message))
                    else p.resolve(msg.result)
                }
            }
        })
    }

    static async connect(wsUrl: string): Promise<CdpClient> {
        const ws = new WebSocket(wsUrl)
        return new Promise((resolve, reject) => {
            ws.on('open', () => resolve(new CdpClient(ws)))
            ws.on('error', reject)
        })
    }

    send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const id = ++this.msgId
            this.pending.set(id, { resolve, reject })
            this.ws.send(JSON.stringify({ id, method, params }))
        })
    }

    async evaluate(expr: string): Promise<unknown> {
        const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true }) as { result?: { value?: unknown } }
        return r?.result?.value
    }

    async insertText(text: string): Promise<void> {
        await this.send('Input.insertText', { text })
    }

    async pressKey(key: string, modifiers = 0): Promise<void> {
        await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.charCodeAt(0), modifiers })
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.charCodeAt(0), modifiers })
    }

    async pressEnter(): Promise<void> {
        await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    }

    async pressEscape(): Promise<void> {
        await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    }

    async screenshot(path: string): Promise<void> {
        const r = await this.send('Page.captureScreenshot', { format: 'png' }) as { data?: string }
        if (r?.data) {
            const fs = await import('fs')
            fs.writeFileSync(path, Buffer.from(r.data, 'base64'))
        }
    }

    async waitFor(condition: () => Promise<boolean>, timeoutMs = 10000, intervalMs = 300): Promise<void> {
        const start = Date.now()
        while (Date.now() - start < timeoutMs) {
            if (await condition()) return
            await new Promise(r => setTimeout(r, intervalMs))
        }
        throw new Error('waitFor timed out')
    }

    close(): void {
        this.ws.close()
    }
}

export async function findTranslateTarget(port: number): Promise<{ wsUrl: string; url: string }> {
    const http = await import('http')
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}/json`, (res) => {
            let data = ''
            res.on('data', (c: Buffer) => data += c.toString())
            res.on('end', () => {
                const targets = JSON.parse(data) as Array<{ webSocketDebuggerUrl: string; url: string }>
                const t = targets.find(t => t.url.includes('translate'))
                if (!t) reject(new Error('No translate target found'))
                else resolve({ wsUrl: t.webSocketDebuggerUrl, url: t.url })
            })
        }).on('error', reject)
    })
}

export const CDP_PORT = 9225
