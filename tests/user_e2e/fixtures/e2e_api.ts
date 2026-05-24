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

    async translate_via_external_api(text: string): Promise<{ success: boolean; error?: string }> {
        return requestText(this.port, '/translate', text) as Promise<{ success: boolean; error?: string }>
    }

    async recognize_via_external_api(body?: { mode?: 'recognize' | 'translate' }): Promise<{ success: boolean; mode: 'recognize' | 'translate'; error?: string }> {
        return request(this.port, 'POST', '/recognize', body) as Promise<{ success: boolean; mode: 'recognize' | 'translate'; error?: string }>
    }

    async get_config_via_external_api(): Promise<Record<string, unknown>> {
        return request(this.port, 'GET', '/config') as Promise<Record<string, unknown>>
    }

    async requestExternal<T>(method: string, path: string, body?: unknown): Promise<T> {
        return request(this.port, method, path, body) as Promise<T>
    }

    async openWindow(label: string): Promise<{ success: boolean; error?: string }> {
        return this.request('POST', '/e2e/open-window', { label }) as Promise<{ success: boolean; error?: string }>
    }

    async resetConfig(): Promise<{ success: boolean }> {
        return this.request('POST', '/e2e/reset-config') as Promise<{ success: boolean }>
    }

    async setConfig(entries: Record<string, unknown>): Promise<{ success: boolean; results?: Record<string, boolean>; error?: string }> {
        return this.request('POST', '/e2e/set-config', entries) as Promise<{ success: boolean; results?: Record<string, boolean>; error?: string }>
    }

    async getConfig(): Promise<Record<string, unknown>> {
        return this.request('GET', '/config') as Promise<Record<string, unknown>>
    }

    async readClipboard(): Promise<{ success: boolean; text: string }> {
        return this.request('GET', '/e2e/clipboard') as Promise<{ success: boolean; text: string }>
    }

    async read_clipboard_image(): Promise<{ success: boolean; is_empty: boolean; size: { width: number; height: number } }> {
        return this.request('GET', '/e2e/clipboard-image') as Promise<{ success: boolean; is_empty: boolean; size: { width: number; height: number } }>
    }

    async windowState(label = 'translate'): Promise<{
        success: boolean
        label: string
        exists: boolean
        visible: boolean
        focused: boolean
        alwaysOnTop: boolean
        transparent: boolean
        bounds: { x: number; y: number; width: number; height: number } | null
    }> {
        return this.request('GET', `/e2e/window-state?label=${encodeURIComponent(label)}`) as Promise<{
            success: boolean
            label: string
            exists: boolean
            visible: boolean
            focused: boolean
            alwaysOnTop: boolean
            transparent: boolean
            bounds: { x: number; y: number; width: number; height: number } | null
        }>
    }

    async primaryDisplay(): Promise<{
        success: boolean
        workArea: { x: number; y: number; width: number; height: number }
    }> {
        return this.request('GET', '/e2e/primary-display') as Promise<{
            success: boolean
            workArea: { x: number; y: number; width: number; height: number }
        }>
    }

    async triggerScreenshot(mode: 'recognize' | 'translate' = 'recognize'): Promise<{ success: boolean; mode: 'recognize' | 'translate'; error?: string }> {
        return this.request('POST', '/e2e/trigger-screenshot', { mode }) as Promise<{ success: boolean; mode: 'recognize' | 'translate'; error?: string }>
    }

    async triggerInputTranslate(): Promise<{ success: boolean; error?: string }> {
        return this.request('POST', '/e2e/trigger-input-translate') as Promise<{ success: boolean; error?: string }>
    }

    async triggerHotkey(name: string, selectionText?: string): Promise<{ success: boolean; error?: string }> {
        return this.request('POST', '/e2e/trigger-hotkey', { name, ...(selectionText !== undefined ? { selectionText } : {}) }) as Promise<{ success: boolean; error?: string }>
    }

    async setHotkeySystemFailures(shortcuts: string[]): Promise<{ success: boolean; error?: string }> {
        return this.request('POST', '/e2e/hotkey-system-failures', { shortcuts }) as Promise<{ success: boolean; error?: string }>
    }

    async trayAction(action: 'input_translate' | 'ocr_recognize' | 'screenshot_translate' | 'clipboard_monitor' | 'config' | 'tray_click' | 'show_tray' | 'restart' | 'quit'): Promise<{ success: boolean; action?: string; error?: string }> {
        return this.request('POST', '/e2e/tray-action', { action }) as Promise<{ success: boolean; action?: string; error?: string }>
    }

    async trayMenu(): Promise<{ success: boolean; labels: string[]; error?: string }> {
        return this.request('GET', '/e2e/tray-menu') as Promise<{ success: boolean; labels: string[]; error?: string }>
    }

    async mockUpdate(release: Partial<{
        version: string
        current_version: string
        name: string
        body: string
        html_url: string
        published_at: string
        assets: Array<{ name: string; url: string; size?: number }>
    }> = {}): Promise<{
        success: boolean
        release?: {
            version: string
            current_version: string
            name: string
            body: string
            html_url: string
            published_at: string
            assets: Array<{ name: string; url: string; size?: number }>
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
                assets: Array<{ name: string; url: string; size?: number }>
            }
            error?: string
        }>
    }

    async captureClock(): Promise<{ success: boolean; image?: string; error?: string }> {
        return this.request('GET', '/capture-clock') as Promise<{ success: boolean; image?: string; error?: string }>
    }
}
