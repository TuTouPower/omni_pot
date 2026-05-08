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
        const r = await this.send('Runtime.evaluate', {
            expression: expr,
            returnByValue: true,
            awaitPromise: true
        }) as { result?: { value?: unknown } }
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

    async click(x: number, y: number): Promise<void> {
        await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
        await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    }

    async mouseDrag(startX: number, startY: number, endX: number, endY: number, steps = 10): Promise<void> {
        await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1 })
        await new Promise(r => setTimeout(r, 30))
        for (let i = 1; i <= steps; i++) {
            const x = Math.round(startX + (endX - startX) * (i / steps))
            const y = Math.round(startY + (endY - startY) * (i / steps))
            await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 })
            await new Promise(r => setTimeout(r, 10))
        }
        await new Promise(r => setTimeout(r, 30))
        await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: endX, y: endY, button: 'left', clickCount: 1 })
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

interface CdpTarget {
    webSocketDebuggerUrl: string
    url: string
    title: string
    id: string
}

async function listTargets(port: number): Promise<CdpTarget[]> {
    const http = await import('http')
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}/json`, (res) => {
            let data = ''
            res.on('data', (c: Buffer) => data += c.toString())
            res.on('end', () => {
                resolve(JSON.parse(data) as CdpTarget[])
            })
        }).on('error', reject)
    })
}

async function findTarget(port: number, urlPattern: string): Promise<CdpTarget> {
    const targets = await listTargets(port)
    const t = targets.find(t => t.url.includes(urlPattern))
    if (!t) throw new Error(`No target found matching "${urlPattern}". Available: ${targets.map(t => t.url).join(', ')}`)
    return t
}

export async function findTranslateTarget(port: number): Promise<{ wsUrl: string; url: string }> {
    const t = await findTarget(port, 'translate')
    return { wsUrl: t.webSocketDebuggerUrl, url: t.url }
}

export async function findConfigTarget(port: number): Promise<{ wsUrl: string; url: string }> {
    const t = await findTarget(port, 'config')
    return { wsUrl: t.webSocketDebuggerUrl, url: t.url }
}

export async function findRecognizeTarget(port: number): Promise<{ wsUrl: string; url: string }> {
    const t = await findTarget(port, 'recognize')
    return { wsUrl: t.webSocketDebuggerUrl, url: t.url }
}

export async function findAllTargets(port: number): Promise<CdpTarget[]> {
    return listTargets(port)
}

export const CDP_PORT = 9225
