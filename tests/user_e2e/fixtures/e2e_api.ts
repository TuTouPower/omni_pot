import http from 'http'

function request(port: number, method: string, path: string, body?: unknown, token?: string): Promise<unknown> {
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
                ...(token ? { 'X-Omni-Pot-E2E-Token': token } : {}),
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

function requestText(port: number, path: string, body: string, token?: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Length': String(Buffer.byteLength(body)),
                ...(token ? { 'X-Omni-Pot-E2E-Token': token } : {}),
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
    constructor(private port: number, private token: string) {}

    private request(method: string, path: string, body?: unknown): Promise<unknown> {
        return request(this.port, method, path, body, this.token)
    }

    private requestText(path: string, body: string): Promise<unknown> {
        return requestText(this.port, path, body, this.token)
    }

    async triggerSelection(text?: string): Promise<{ success: boolean; method?: string; reason?: string }> {
        return this.request('POST', '/trigger-selection', text ? { text } : undefined) as Promise<{ success: boolean; method?: string; reason?: string }>
    }

    async triggerDict(text: string): Promise<{ success: boolean; error?: string }> {
        return this.request('POST', '/trigger-dict', { text }) as Promise<{ success: boolean; error?: string }>
    }

    async triggerClipboard(text: string): Promise<{ success: boolean; error?: string }> {
        return this.request('POST', '/trigger-clipboard', { text }) as Promise<{ success: boolean; error?: string }>
    }

    async triggerClipboardTranslate(text: string): Promise<{ success: boolean; error?: string }> {
        return this.request('POST', '/trigger-clipboard-translate', { text }) as Promise<{ success: boolean; error?: string }>
    }

    async translateViaHttp(text: string): Promise<{ success: boolean }> {
        return this.requestText('/translate', text) as Promise<{ success: boolean }>
    }

    async openWindow(label: string): Promise<{ success: boolean; error?: string }> {
        return this.request('POST', '/e2e/open-window', { label }) as Promise<{ success: boolean; error?: string }>
    }

    async resetConfig(): Promise<{ success: boolean }> {
        return this.request('POST', '/e2e/reset-config') as Promise<{ success: boolean }>
    }

    async getConfig(): Promise<Record<string, unknown>> {
        return this.request('GET', '/config') as Promise<Record<string, unknown>>
    }

    async readClipboard(): Promise<{ success: boolean; text: string }> {
        return this.request('GET', '/e2e/clipboard') as Promise<{ success: boolean; text: string }>
    }

    async windowState(label = 'translate'): Promise<{
        success: boolean
        label: string
        exists: boolean
        visible: boolean
        focused: boolean
        alwaysOnTop: boolean
        bounds: { x: number; y: number; width: number; height: number } | null
    }> {
        return this.request('GET', `/e2e/window-state?label=${encodeURIComponent(label)}`) as Promise<{
            success: boolean
            label: string
            exists: boolean
            visible: boolean
            focused: boolean
            alwaysOnTop: boolean
            bounds: { x: number; y: number; width: number; height: number } | null
        }>
    }

    async triggerScreenshot(mode: 'recognize' | 'translate' = 'recognize'): Promise<{ success: boolean; mode: 'recognize' | 'translate'; error?: string }> {
        return this.request('POST', '/e2e/trigger-screenshot', { mode }) as Promise<{ success: boolean; mode: 'recognize' | 'translate'; error?: string }>
    }

    async triggerInputTranslate(): Promise<{ success: boolean; error?: string }> {
        return this.request('POST', '/e2e/trigger-input-translate') as Promise<{ success: boolean; error?: string }>
    }

    async trayAction(action: 'input_translate' | 'clipboard_monitor' | 'config' | 'tray_click'): Promise<{ success: boolean; action?: string; error?: string }> {
        return this.request('POST', '/e2e/tray-action', { action }) as Promise<{ success: boolean; action?: string; error?: string }>
    }

    async mockUpdate(release: Partial<{
        version: string
        current_version: string
        name: string
        body: string
        html_url: string
        published_at: string
    }> = {}): Promise<{
        success: boolean
        release?: {
            version: string
            current_version: string
            name: string
            body: string
            html_url: string
            published_at: string
            assets: Array<{ name: string; url: string }>
        }
        error?: string
    }> {
        return this.request('POST', '/e2e/mock-update', release) as Promise<{
            success: boolean
            release?: {
                version: string
                current_version: string
                name: string
                body: string
                html_url: string
                published_at: string
                assets: Array<{ name: string; url: string }>
            }
            error?: string
        }>
    }

    async captureClock(): Promise<{ success: boolean; image?: string; error?: string }> {
        return this.request('GET', '/capture-clock') as Promise<{ success: boolean; image?: string; error?: string }>
    }
}
