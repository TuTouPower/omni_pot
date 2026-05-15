import http from 'http'
import { app, clipboard, desktopCapturer, screen } from 'electron'
import { getConfig, getAllConfig, setConfig } from '../config/store'
import { DEFAULT_CONFIG } from '@shared/types/config'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { get_translate_window_options } from '../windows/translate_options'
import { start_screenshot_capture } from '../screenshot'
import { trigger_tray_action } from '../tray'
import { readSelectedText } from '../selection'

const DICT_OPTS = {
    label: WindowLabel.DICT,
    width: 350,
    height: 420
}

const IS_E2E = !!process.env.OMNI_POT_E2E
const E2E_TOKEN = process.env.OMNI_POT_E2E_TOKEN ?? ''

function is_e2e_request(req: http.IncomingMessage): boolean {
    return IS_E2E && !!E2E_TOKEN && req.headers['x-omni-pot-e2e-token'] === E2E_TOKEN
}

let server: http.Server | null = null

export function startServer(mgr: WindowManager): Promise<void> {
    if (server) return Promise.resolve()

    const port = getConfig('server_port') as number

    return new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Omni-Pot-E2E-Token')

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

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/trigger-selection') {
                handleTriggerSelection(mgr, req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/trigger-dict') {
                handleTriggerDict(mgr, req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/trigger-clipboard') {
                handleTriggerClipboard(req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/trigger-clipboard-translate') {
                handleTriggerClipboardTranslate(mgr, req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'GET' && url.pathname === '/capture-clock') {
                handleCaptureClock(res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/open-window') {
                handleOpenWindow(mgr, req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/reset-config') {
                handleResetConfig(res)
                return
            }

            if (is_e2e_request(req) && req.method === 'GET' && url.pathname === '/e2e/clipboard') {
                handleReadClipboard(res)
                return
            }

            if (is_e2e_request(req) && req.method === 'GET' && url.pathname === '/e2e/window-state') {
                handleWindowState(mgr, url, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/trigger-screenshot') {
                handle_trigger_screenshot(mgr, req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/trigger-input-translate') {
                handle_trigger_input_translate(mgr, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/tray-action') {
                handle_tray_action(req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/mock-update') {
                handle_mock_update(mgr, req, res)
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

        const win = mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
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
                    const result = await readSelectedText()
                    if (!result.text.trim()) {
                        res.writeHead(200)
                        res.end(JSON.stringify({ success: false, reason: result.reason ?? 'empty' }))
                        return
                    }
                    textToUse = result.text
                    method = result.method
                }

                mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
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

function handleTriggerDict(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        try {
            const body = Buffer.concat(chunks).toString('utf-8').trim()
            let text = ''
            if (body) {
                try {
                    const json = JSON.parse(body)
                    if (typeof json.text === 'string') text = json.text
                } catch { /* ignore */ }
            }
            if (!text.trim()) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'empty text' }))
                return
            }
            mgr.focusOrCreate(WindowLabel.DICT, DICT_OPTS)
            mgr.sendWhenReady(WindowLabel.DICT, 'dict:lookup', text)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
        } catch (error: unknown) {
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(error) }))
        }
    })
}

function handleTriggerClipboard(
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        try {
            const body = Buffer.concat(chunks).toString('utf-8').trim()
            let text = ''
            if (body) {
                try {
                    const json = JSON.parse(body)
                    if (typeof json.text === 'string') text = json.text
                } catch { /* ignore */ }
            }
            if (!text.trim()) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'empty text' }))
                return
            }
            clipboard.writeText(text)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
        } catch (error: unknown) {
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(error) }))
        }
    })
}

function handleTriggerClipboardTranslate(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        try {
            const body = Buffer.concat(chunks).toString('utf-8').trim()
            let text = ''
            if (body) {
                try {
                    const json = JSON.parse(body)
                    if (typeof json.text === 'string') text = json.text
                } catch { /* ignore */ }
            }
            if (!text.trim()) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'empty text' }))
                return
            }
            mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
            mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-clipboard', text)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
        } catch (error: unknown) {
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(error) }))
        }
    })
}

function handleCaptureClock(res: http.ServerResponse): void {
    void (async () => {
        try {
            const primaryDisplay = screen.getPrimaryDisplay()
            const { width, height } = primaryDisplay.bounds
            const sf = primaryDisplay.scaleFactor

            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: {
                    width: Math.floor(width * sf),
                    height: Math.floor(height * sf)
                }
            })

            if (sources.length === 0) {
                res.writeHead(500)
                res.end(JSON.stringify({ success: false, error: 'no screen source' }))
                return
            }

            const thumb = sources[0].thumbnail
            const thumbSize = thumb.getSize()

            // Crop bottom-right where the Windows taskbar clock is
            const cropW = Math.floor(300 * sf)
            const cropH = Math.floor(70 * sf)
            const cropX = Math.max(0, thumbSize.width - cropW)
            const cropY = Math.max(0, thumbSize.height - cropH)

            const cropped = thumb.crop({ x: cropX, y: cropY, width: cropW, height: cropH })
            const base64 = cropped.toPNG().toString('base64')

            res.writeHead(200)
            res.end(JSON.stringify({ success: true, image: base64 }))
        } catch (error: unknown) {
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(error) }))
        }
    })()
}

function handleOpenWindow(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
            const label = body.label as string
            if (!label) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'missing label' }))
                return
            }

            const windowOpts: Record<string, { label: typeof WindowLabel[keyof typeof WindowLabel]; width: number; height: number }> = {
                dict: { label: WindowLabel.DICT, width: 350, height: 420 },
                config: { label: WindowLabel.CONFIG, width: 800, height: 600 },
                recognize: { label: WindowLabel.RECOGNIZE, width: 600, height: 500 },
                updater: { label: WindowLabel.UPDATER, width: 400, height: 300 },
            }

            const opts = label === 'translate' ? get_translate_window_options() : windowOpts[label]
            if (!opts) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: `unknown label: ${label}` }))
                return
            }

            mgr.focusOrCreate(opts.label, opts)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
        } catch (error: unknown) {
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(error) }))
        }
    })
}

function handleResetConfig(res: http.ServerResponse): void {
    try {
        for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
            setConfig(key as keyof typeof DEFAULT_CONFIG, value)
        }
        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))
    } catch (error: unknown) {
        res.writeHead(500)
        res.end(JSON.stringify({ success: false, error: String(error) }))
    }
}

function handleReadClipboard(res: http.ServerResponse): void {
    try {
        const text = clipboard.readText()
        res.writeHead(200)
        res.end(JSON.stringify({ success: true, text }))
    } catch (error: unknown) {
        res.writeHead(500)
        res.end(JSON.stringify({ success: false, error: String(error) }))
    }
}

function handleWindowState(
    mgr: WindowManager,
    url: URL,
    res: http.ServerResponse
): void {
    const label = url.searchParams.get('label') || WindowLabel.TRANSLATE
    if (!Object.values(WindowLabel).includes(label as WindowLabel)) {
        res.writeHead(400)
        res.end(JSON.stringify({ success: false, error: `unknown label: ${label}` }))
        return
    }

    const win = mgr.getWindow(label as WindowLabel)
    if (!win) {
        res.writeHead(200)
        res.end(JSON.stringify({ success: true, label, exists: false, visible: false, alwaysOnTop: false, bounds: null }))
        return
    }

    res.writeHead(200)
    res.end(JSON.stringify({
        success: true,
        label,
        exists: true,
        visible: win.isVisible(),
        alwaysOnTop: win.isAlwaysOnTop(),
        bounds: win.getBounds(),
    }))
}

function parse_json_body(chunks: Buffer[]): Record<string, unknown> {
    const body = Buffer.concat(chunks).toString('utf-8').trim()
    if (!body) return {}
    const parsed = JSON.parse(body) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
}

function handle_trigger_screenshot(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        void (async () => {
            try {
                const body = parse_json_body(chunks)
                const mode = body.mode === 'translate' ? 'translate' : 'recognize'
                const success = await start_screenshot_capture(mgr, mode)
                res.writeHead(success ? 200 : 500)
                res.end(JSON.stringify(success ? { success: true, mode } : { success: false, error: 'screenshot capture failed' }))
            } catch (error: unknown) {
                res.writeHead(500)
                res.end(JSON.stringify({ success: false, error: String(error) }))
            }
        })()
    })
}

function handle_trigger_input_translate(
    mgr: WindowManager,
    res: http.ServerResponse
): void {
    try {
        mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
        mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:input-translate')
        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))
    } catch (error: unknown) {
        res.writeHead(500)
        res.end(JSON.stringify({ success: false, error: String(error) }))
    }
}

function handle_tray_action(
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        try {
            const body = parse_json_body(chunks)
            const action = typeof body.action === 'string' ? body.action : ''
            if (!action) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'missing action' }))
                return
            }
            if (!trigger_tray_action(action)) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: `unknown tray action: ${action}` }))
                return
            }
            res.writeHead(200)
            res.end(JSON.stringify({ success: true, action }))
        } catch (error: unknown) {
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(error) }))
        }
    })
}

function handle_mock_update(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        try {
            const body = parse_json_body(chunks)
            const release = {
                version: typeof body.version === 'string' ? body.version : '9.9.9',
                current_version: typeof body.current_version === 'string' ? body.current_version : app.getVersion(),
                name: typeof body.name === 'string' ? body.name : 'E2E Release',
                body: typeof body.body === 'string' ? body.body : 'E2E changelog',
                html_url: typeof body.html_url === 'string' ? body.html_url : '',
                published_at: typeof body.published_at === 'string' ? body.published_at : '1970-01-01T00:00:00.000Z',
                assets: [] as Array<{ name: string; url: string }>,
            }

            mgr.focusOrCreate(WindowLabel.UPDATER, {
                label: WindowLabel.UPDATER,
                width: 480,
                height: 520,
                resizable: true,
            })
            mgr.sendWhenReady(WindowLabel.UPDATER, 'updater:release', release)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true, release }))
        } catch (error: unknown) {
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(error) }))
        }
    })
}
