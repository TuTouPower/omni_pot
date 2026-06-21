import http from 'http'
import { getConfig, getAllConfig } from '../config/store'
import { is_config_value_allowed } from '../config/validation'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { get_translate_window_options } from '../windows/translate_options'
import { get_dict_window_options } from '../windows/dict_options'
import { start_screenshot_capture } from '../screenshot'
import { log } from '../log'
import { captured_open_external_urls } from '../ipc/shell_handlers'
import { get_history_page, get_history_count } from '../history'
import { BodyTooLargeError, readBody, respondBodyTooLarge, MAX_OCR_BODY_SIZE, MAX_TRANSLATE_BODY_SIZE } from './body'
import { get_public_config_from_config, type PublicConfig } from './public_config'
import {
    handleTriggerSelection,
    handleTriggerDict,
    handleTriggerClipboard,
    handleTriggerClipboardTranslate,
    handleCaptureClock,
    handleOpenWindow,
    handleResetConfig,
    handleSetConfig,
    handleReadClipboard,
    handle_read_clipboard_image,
    handleWindowState,
    handle_window_display,
    handle_primary_display,
    handle_trigger_screenshot,
    handle_open_recognize,
    handle_add_history,
    handle_trigger_input_translate,
    handle_trigger_hotkey,
    handle_hotkey_system_failures,
    handle_tray_action,
    handle_tray_menu,
    handle_mock_update,
} from './e2e_handlers'

export { is_config_value_allowed }
export { get_public_config_from_config }

const log_server = log.scope('server')

const IS_E2E = !!process.env.OMNI_POT_E2E
const E2E_TOKEN = process.env.OMNI_POT_E2E_TOKEN ?? ''

const API_TOKEN_HEADER = 'x-omni-pot-api-token'

export function is_api_token_allowed(expected_token: string, provided_token: string | string[] | undefined): boolean {
    return typeof provided_token === 'string' && !!expected_token && provided_token === expected_token
}

export function is_host_allowed(host: string): boolean {
    if (!host) return false
    try {
        const url = new URL(`http://${host}`)
        return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    } catch {
        return false
    }
}

export function is_origin_allowed(origin: string): boolean {
    if (!origin) return false
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(origin)) return false
    try {
        const url = new URL(origin)
        return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    } catch {
        return false
    }
}

export function should_reject_origin(origin: string): boolean {
    return !!origin && !is_origin_allowed(origin)
}

function is_e2e_request(req: http.IncomingMessage): boolean {
    return IS_E2E && !!E2E_TOKEN && req.headers['x-omni-pot-e2e-token'] === E2E_TOKEN
}

function is_api_request(req: http.IncomingMessage): boolean {
    const expected_token = getConfig('server_api_token')
    return typeof expected_token === 'string' && is_api_token_allowed(expected_token, req.headers[API_TOKEN_HEADER])
}

function is_local_api_request(req: http.IncomingMessage): boolean {
    return is_e2e_request(req) || is_api_request(req)
}

function respond_unauthorized(res: http.ServerResponse): void {
    res.writeHead(401)
    res.end(JSON.stringify({ success: false, error: 'unauthorized' }))
}

function get_public_config(): PublicConfig {
    return get_public_config_from_config(getAllConfig())
}

let server: http.Server | null = null

export function startServer(mgr: WindowManager): Promise<void> {
    if (server) return Promise.resolve()

    const port = getConfig('server_port') as number

    return new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            res.setHeader('Content-Type', 'application/json')

            // Validate Host header to prevent DNS rebinding
            const host = req.headers.host ?? ''
            if (!is_host_allowed(host)) {
                res.writeHead(403)
                res.end(JSON.stringify({ success: false, error: 'forbidden' }))
                return
            }

            // CORS: allow only localhost origins and reject cross-site actions
            const origin = req.headers.origin ?? ''
            if (should_reject_origin(origin)) {
                res.writeHead(403)
                res.end(JSON.stringify({ success: false, error: 'forbidden' }))
                return
            }
            if (origin) {
                res.setHeader('Access-Control-Allow-Origin', origin)
            }
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Omni-Pot-Api-Token, X-Omni-Pot-E2E-Token')

            if (req.method === 'OPTIONS') {
                res.writeHead(204)
                res.end()
                return
            }

            const url = new URL(req.url ?? '/', `http://localhost:${String(port)}`)

            if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '/translate')) {
                if (!is_local_api_request(req)) { respond_unauthorized(res); return }
                handleTranslate(mgr, req, res)
                return
            }

            if (req.method === 'POST' && url.pathname === '/recognize') {
                if (!is_local_api_request(req)) { respond_unauthorized(res); return }
                ;(async () => {
                    try {
                        const buf = await readBody(req, MAX_OCR_BODY_SIZE)
                        let mode: 'recognize' | 'translate' = 'recognize'
                        const body = buf.toString('utf-8').trim()
                        if (body.startsWith('{')) {
                            try {
                                const json = JSON.parse(body) as { mode?: unknown }
                                if (json.mode === 'translate') mode = 'translate'
                            } catch { /* keep default */ }
                        }
                        start_screenshot_capture(mgr, mode).catch((err: unknown) => {
                            log_server.error('recognize via HTTP failed: %s', err)
                        })
                        res.writeHead(200)
                        res.end(JSON.stringify({ success: true, mode }))
                    } catch (err: unknown) {
                        if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
                        res.writeHead(500)
                        res.end(JSON.stringify({ success: false, error: String(err) }))
                    }
                })().catch((err: unknown) => { log_server.error(err) })
                return
            }

            if (req.method === 'GET' && url.pathname === '/config') {
                if (!is_local_api_request(req)) { respond_unauthorized(res); return }
                res.writeHead(200)
                res.end(JSON.stringify(is_e2e_request(req) ? getAllConfig() : get_public_config()))
                return
            }

            if (req.method === 'POST' && url.pathname === '/dict') {
                if (!is_local_api_request(req)) { respond_unauthorized(res); return }
                handleDictLookup(mgr, req, res)
                return
            }

            if (req.method === 'GET' && url.pathname === '/history') {
                if (!is_local_api_request(req)) { respond_unauthorized(res); return }
                handleHistory(url, req, res)
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

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/set-config') {
                handleSetConfig(req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'GET' && url.pathname === '/e2e/clipboard') {
                handleReadClipboard(res)
                return
            }

            if (is_e2e_request(req) && req.method === 'GET' && url.pathname === '/e2e/clipboard-image') {
                handle_read_clipboard_image(res)
                return
            }

            if (is_e2e_request(req) && req.method === 'GET' && url.pathname === '/e2e/window-state') {
                handleWindowState(mgr, url, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'GET' && url.pathname === '/e2e/window-display') {
                handle_window_display(mgr, url, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'GET' && url.pathname === '/e2e/primary-display') {
                handle_primary_display(res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/trigger-screenshot') {
                handle_trigger_screenshot(mgr, req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/open-recognize') {
                handle_open_recognize(mgr, req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/add-history') {
                handle_add_history(req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/trigger-input-translate') {
                handle_trigger_input_translate(mgr, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/trigger-hotkey') {
                handle_trigger_hotkey(mgr, req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/hotkey-system-failures') {
                handle_hotkey_system_failures(req, res)
                return
            }

            if ((is_e2e_request(req) || is_api_request(req)) && req.method === 'POST' && url.pathname === '/e2e/tray-action') {
                handle_tray_action(req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'GET' && url.pathname === '/e2e/tray-menu') {
                handle_tray_menu(res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/mock-update') {
                handle_mock_update(mgr, req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'GET' && url.pathname === '/e2e/shell-open-external') {
                res.writeHead(200)
                res.end(JSON.stringify({ success: true, urls: [...captured_open_external_urls] }))
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/shell-open-external/reset') {
                captured_open_external_urls.length = 0
                res.writeHead(200)
                res.end(JSON.stringify({ success: true }))
                return
            }

            res.writeHead(404)
            res.end(JSON.stringify({ success: false, error: 'not found' }))
        })

        server.once('listening', () => {
            log_server.info('HTTP server listening on 127.0.0.1:%d', port)
            resolve()
        })

        server.once('error', (err: NodeJS.ErrnoException) => {
            log_server.error('HTTP server failed to start on port %d: %s (%s)', port, err.message, err.code)
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
    ;(async () => {
        try {
            const buf = await readBody(req, MAX_TRANSLATE_BODY_SIZE)
            const text = buf.toString('utf-8').trim()
            if (!text) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'empty body' }))
                return
            }

            mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
            mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-api', text)

            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}

function handleDictLookup(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = buf.toString('utf-8').trim()
            let text = body
            if (body.startsWith('{')) {
                try {
                    const json = JSON.parse(body) as { text?: unknown }
                    if (typeof json.text === 'string') text = json.text
                } catch { /* fall through */ }
            }
            const trimmed = text.trim()
            if (!trimmed) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'empty body' }))
                return
            }
            mgr.focusOrCreate(WindowLabel.DICT, get_dict_window_options('http'))
            mgr.sendWhenReady(WindowLabel.DICT, 'dict:lookup', trimmed)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}

function handleHistory(
    url: URL,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    // eslint-disable-next-line @typescript-eslint/require-await -- consistent pattern with other async handlers
    ;(async () => {
        try {
            const page = Number(url.searchParams.get('page') ?? '1')
            const page_size = Number(url.searchParams.get('page_size') ?? '20')
            const safe_page = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
            const safe_size = Number.isFinite(page_size) && page_size > 0 ? Math.min(Math.floor(page_size), 200) : 20
            const full_text = is_e2e_request(req) && url.searchParams.get('full_text') === 'true'
            const data = get_history_page(safe_page, safe_size)
            // Privacy: truncate source/target text unless full_text is requested
            const processed_data = full_text ? data : data.map((record) => ({
                ...record,
                source_text: record.source_text.length > 50 ? record.source_text.slice(0, 50) + '...' : record.source_text,
                target_text: record.target_text.length > 50 ? record.target_text.slice(0, 50) + '...' : record.target_text,
            }))
            const total = get_history_count()
            res.writeHead(200)
            res.end(JSON.stringify({ success: true, data: processed_data, page: safe_page, page_size: safe_size, total }))
        } catch (err: unknown) {
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}
