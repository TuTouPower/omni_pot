import http from 'http'

function request(port: number, method: string, path: string, body?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const bodyStr = body ? JSON.stringify(body) : ''
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(bodyStr ? { 'Content-Length': String(Buffer.byteLength(bodyStr)) } : {}),
            },
        }, (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk: Buffer) => chunks.push(chunk))
            res.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString()))
                } catch {
                    resolve(undefined)
                }
            })
        })
        req.on('error', reject)
        if (bodyStr) req.write(bodyStr)
        req.end()
    })
}

function requestText(port: number, path: string, body: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Length': String(Buffer.byteLength(body)),
            },
        }, (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk: Buffer) => chunks.push(chunk))
            res.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString()))
                } catch {
                    resolve(undefined)
                }
            })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
    })
}

export class E2eApi {
    constructor(private port: number) {}

    async triggerSelection(text?: string): Promise<{ success: boolean; method?: string; reason?: string }> {
        return request(this.port, 'POST', '/trigger-selection', text ? { text } : undefined) as Promise<{ success: boolean; method?: string; reason?: string }>
    }

    async triggerDict(text: string): Promise<{ success: boolean; error?: string }> {
        return request(this.port, 'POST', '/trigger-dict', { text }) as Promise<{ success: boolean; error?: string }>
    }

    async triggerClipboard(text: string): Promise<{ success: boolean; error?: string }> {
        return request(this.port, 'POST', '/trigger-clipboard', { text }) as Promise<{ success: boolean; error?: string }>
    }

    async triggerClipboardTranslate(text: string): Promise<{ success: boolean; error?: string }> {
        return request(this.port, 'POST', '/trigger-clipboard-translate', { text }) as Promise<{ success: boolean; error?: string }>
    }

    async translateViaHttp(text: string): Promise<{ success: boolean }> {
        return requestText(this.port, '/translate', text) as Promise<{ success: boolean }>
    }

    async openWindow(label: string): Promise<{ success: boolean; error?: string }> {
        return request(this.port, 'POST', '/e2e/open-window', { label }) as Promise<{ success: boolean; error?: string }>
    }

    async resetConfig(): Promise<{ success: boolean }> {
        return request(this.port, 'POST', '/e2e/reset-config') as Promise<{ success: boolean }>
    }

    async getConfig(): Promise<Record<string, unknown>> {
        return request(this.port, 'GET', '/config') as Promise<Record<string, unknown>>
    }

    async readClipboard(): Promise<{ success: boolean; text: string }> {
        return request(this.port, 'GET', '/e2e/clipboard') as Promise<{ success: boolean; text: string }>
    }

    async captureClock(): Promise<{ success: boolean; image?: string; error?: string }> {
        return request(this.port, 'GET', '/capture-clock') as Promise<{ success: boolean; image?: string; error?: string }>
    }
}
