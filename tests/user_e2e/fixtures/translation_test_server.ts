import http from 'http'

export interface TestServerRequest {
    url: string
    method: string
    body?: string
}

export interface LingvaResponseControl {
    translation: string
    delay_ms?: number
    status?: number
}

export interface MyMemoryResponseControl {
    translated_text: string
    delay_ms?: number
    status?: number
}

/**
 * Local HTTP test server that simulates Lingva and MyMemory translation APIs.
 * Allows tests to control responses (text, delay, status) and inspect requests
 * that the app sends — via real HTTP, not page-level fetch mocking.
 *
 * Lingva API: GET /api/v1/{from}/{to}/{text}
 * MyMemory API: GET /get?q=...&langpair=...
 */
export class TranslationTestServer {
    private server: http.Server | null = null
    private port = 0

    // Controllable responses
    private lingva_response: LingvaResponseControl | null = null
    private mymemory_response: MyMemoryResponseControl | null = null

    // Request tracking
    readonly requests: TestServerRequest[] = []

    // Hold mechanism: requests wait until released
    private held = false
    private hold_resolvers: Array<() => void> = []

    async start(): Promise<number> {
        this.server = http.createServer(async (req, res) => {
            const url = new URL(req.url || '/', `http://127.0.0.1:${String(this.port)}`)
            this.requests.push({ url: req.url || '', method: req.method || 'GET' })

            if (this.held) {
                await new Promise<void>(resolve => { this.hold_resolvers.push(resolve) })
            }

            // Lingva: /api/v1/{from}/{to}/{text}
            if (url.pathname.startsWith('/api/v1/')) {
                const ctrl = this.lingva_response
                if (!ctrl) {
                    res.writeHead(500, { 'content-type': 'application/json' })
                    res.end(JSON.stringify({ error: 'no lingva response configured' }))
                    return
                }
                if (ctrl.delay_ms) {
                    await new Promise(r => setTimeout(r, ctrl.delay_ms))
                }
                res.writeHead(ctrl.status ?? 200, { 'content-type': 'application/json' })
                res.end(JSON.stringify({ translation: ctrl.translation }))
                return
            }

            // MyMemory: /get?q=...&langpair=...
            if (url.pathname === '/get') {
                const ctrl = this.mymemory_response
                if (!ctrl) {
                    res.writeHead(500, { 'content-type': 'application/json' })
                    res.end(JSON.stringify({ responseStatus: 500 }))
                    return
                }
                if (ctrl.delay_ms) {
                    await new Promise(r => setTimeout(r, ctrl.delay_ms))
                }
                res.writeHead(ctrl.status ?? 200, { 'content-type': 'application/json' })
                res.end(JSON.stringify({
                    responseData: { translatedText: ctrl.translated_text },
                    responseStatus: ctrl.status ?? 200,
                }))
                return
            }

            res.writeHead(404)
            res.end('not found')
        })

        return new Promise(resolve => {
            this.server!.listen(0, '127.0.0.1', () => {
                const addr = this.server!.address()
                if (addr && typeof addr === 'object') {
                    this.port = addr.port
                }
                resolve(this.port)
            })
        })
    }

    async stop(): Promise<void> {
        this.release_all()
        if (this.server) {
            await new Promise<void>((resolve, reject) => {
                this.server!.close(err => { err ? reject(err) : resolve() })
            })
            this.server = null
        }
    }

    get base_url(): string {
        return `http://127.0.0.1:${String(this.port)}`
    }

    // --- Response control ---

    set_lingva_response(response: LingvaResponseControl | null): void {
        this.lingva_response = response
    }

    set_mymemory_response(response: MyMemoryResponseControl | null): void {
        this.mymemory_response = response
    }

    // --- Hold/release for loading tests ---

    hold_requests(): void {
        this.held = true
    }

    release_all(): void {
        this.held = false
        for (const resolve of this.hold_resolvers) resolve()
        this.hold_resolvers = []
    }

    // --- Request inspection ---

    clear_requests(): void {
        this.requests.length = 0
    }

    get request_count(): number {
        return this.requests.length
    }
}
