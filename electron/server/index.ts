import http from 'http'
import { getConfig, getAllConfig } from '../config/store'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'

const TRANSLATE_OPTS = {
    label: WindowLabel.TRANSLATE,
    width: 350,
    height: 420
}

const IS_E2E = !!process.env.OMNI_POT_E2E

let server: http.Server | null = null

export function startServer(mgr: WindowManager): Promise<void> {
    if (server) return Promise.resolve()

    const port = getConfig('server_port') as number

    return new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

            if (req.method === 'OPTIONS') {
                res.writeHead(204)
                res.end()
                return
            }

            const url = new URL(req.url ?? '/', `http://localhost:${port}`)

            if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '/translate')) {
                handleTranslate(mgr, req, res)
                return
            }

            if (req.method === 'POST' && url.pathname === '/recognize') {
                res.writeHead(200)
                res.end(JSON.stringify({ success: true, message: 'recognize stub' }))
                return
            }

            if (req.method === 'GET' && url.pathname === '/config') {
                res.writeHead(200)
                res.end(JSON.stringify(getAllConfig()))
                return
            }

            if (req.method === 'GET' && url.pathname === '/history') {
                res.writeHead(200)
                res.end(JSON.stringify({ success: true, message: 'history stub', data: [] }))
                return
            }

            if (IS_E2E && req.method === 'POST' && url.pathname === '/trigger-selection') {
                handleTriggerSelection(mgr, req, res)
                return
            }

            res.writeHead(404)
            res.end(JSON.stringify({ success: false, error: 'not found' }))
        })

        server.once('listening', () => {
            console.log('[server] HTTP server listening on 127.0.0.1:%d', port)
            resolve()
        })

        server.once('error', (err: NodeJS.ErrnoException) => {
            console.error('[server] HTTP server failed to start on port %d: %s (%s)', port, err.message, err.code)
            server?.close()
            server = null
            reject(err)
        })

        server.listen(port, '127.0.0.1')
    })
}

export function stopServer(): void {
    if (server) {
        server.close()
        server = null
    }
}

function handleTranslate(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8').trim()
        if (!text) {
            res.writeHead(400)
            res.end(JSON.stringify({ success: false, error: 'empty body' }))
            return
        }

        const win = mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
        mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-api', text)

        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))
    })
}

function handleTriggerSelection(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        void (async () => {
            try {
                const body = Buffer.concat(chunks).toString('utf-8').trim()
                let textToUse: string | null = null
                let method = 'e2e'

                // E2E text injection: if JSON body has text field, use it
                if (body) {
                    try {
                        const json = JSON.parse(body)
                        if (typeof json.text === 'string' && json.text.trim()) {
                            textToUse = json.text
                        }
                    } catch {
                        // not JSON, ignore
                    }
                }

                // If no injected text, read from OS
                if (textToUse === null) {
                    const { readSelectedText } = await import('../selection')
                    const result = await readSelectedText()
                    if (!result.text.trim()) {
                        res.writeHead(200)
                        res.end(JSON.stringify({ success: false, reason: result.reason ?? 'empty' }))
                        return
                    }
                    textToUse = result.text
                    method = result.method
                }

                mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
                mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-selection', textToUse)

                res.writeHead(200)
                res.end(JSON.stringify({ success: true, method }))
            } catch (error: unknown) {
                res.writeHead(500)
                res.end(JSON.stringify({ success: false, error: String(error) }))
            }
        })()
    })
}
