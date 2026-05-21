import http from 'http'
import { app, clipboard, desktopCapturer, screen } from 'electron'
import { getConfig, getAllConfig, setConfig } from '../config/store'
import { DEFAULT_CONFIG } from '@shared/types/config'
import type { AppConfig } from '@shared/types/config'

type PublicConfig = Omit<AppConfig, 'service_instances'> & {
    service_instances: Record<string, { serviceKey: string; config: Record<string, unknown> }>
}
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { get_translate_window_options } from '../windows/translate_options'
import { get_dict_window_options } from '../windows/dict_options'
import { get_recognize_window_options } from '../windows/recognize_options'
import { start_screenshot_capture } from '../screenshot'
import { trigger_tray_action, get_tray_menu_labels } from '../tray'
import { hasRegisteredHotkey, triggerRegisteredHotkey, setE2eHotkeySystemFailures, triggerTranslateEntry } from '../hotkey'
import { readSelectedText, setE2eSelectedTextResult } from '../selection'
import { get_history_page, get_history_count } from '../history'
import { log } from '../log'

const log_server = log.scope('server')

const IS_E2E = !!process.env.OMNI_POT_E2E
const E2E_TOKEN = process.env.OMNI_POT_E2E_TOKEN ?? ''

function is_e2e_request(req: http.IncomingMessage): boolean {
    return IS_E2E && !!E2E_TOKEN && req.headers['x-omni-pot-e2e-token'] === E2E_TOKEN
}

const PUBLIC_SERVICE_CONFIG_KEYS = new Set(['enable', 'instanceName'])
const REDACTED_CONFIG_VALUE = '[redacted]'

function redact_service_config(config: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(config).map(([key, value]) => [
        key,
        PUBLIC_SERVICE_CONFIG_KEYS.has(key) ? value : REDACTED_CONFIG_VALUE,
    ]))
}

function get_public_config(): PublicConfig {
    const config = getAllConfig()
    return {
        ...config,
        ...Object.fromEntries(['webdav_password'].map((key) => [key, REDACTED_CONFIG_VALUE])),
        service_instances: Object.fromEntries(Object.entries(config.service_instances).map(([instance_key, instance]) => [
            instance_key,
            {
                serviceKey: instance.serviceKey,
                config: redact_service_config(instance.config),
            },
        ])),
    }
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

            const url = new URL(req.url ?? '/', `http://localhost:${String(port)}`)

            if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '/translate')) {
                handleTranslate(mgr, req, res)
                return
            }

            if (req.method === 'POST' && url.pathname === '/recognize') {
                const chunks: Buffer[] = []
                req.on('data', (chunk: Buffer) => chunks.push(chunk))
                req.on('end', () => {
                    let mode: 'recognize' | 'translate' = 'recognize'
                    const body = Buffer.concat(chunks).toString('utf-8').trim()
                    if (body.startsWith('{')) {
                        try {
                            const json = JSON.parse(body) as { mode?: unknown }
                            if (json.mode === 'translate') mode = 'translate'
                        } catch { /* keep default */ }
                    }
                    res.writeHead(200)
                    res.end(JSON.stringify({ success: true, mode }))
                })
                return
            }

            if (req.method === 'GET' && url.pathname === '/config') {
                res.writeHead(200)
                res.end(JSON.stringify(is_e2e_request(req) ? getAllConfig() : get_public_config()))
                return
            }

            if (req.method === 'POST' && url.pathname === '/dict') {
                handleDictLookup(mgr, req, res)
                return
            }

            if (req.method === 'GET' && url.pathname === '/history') {
                const page = Number(url.searchParams.get('page') ?? '1')
                const page_size = Number(url.searchParams.get('page_size') ?? '20')
                const safe_page = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
                const safe_size = Number.isFinite(page_size) && page_size > 0 ? Math.min(Math.floor(page_size), 200) : 20
                const data = get_history_page(safe_page, safe_size)
                const total = get_history_count()
                res.writeHead(200)
                res.end(JSON.stringify({ success: true, data, page: safe_page, page_size: safe_size, total }))
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

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/trigger-hotkey') {
                handle_trigger_hotkey(mgr, req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/hotkey-system-failures') {
                handle_hotkey_system_failures(req, res)
                return
            }

            if (is_e2e_request(req) && req.method === 'POST' && url.pathname === '/e2e/tray-action') {
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
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8').trim()
        if (!text) {
            res.writeHead(400)
            res.end(JSON.stringify({ success: false, error: 'empty body' }))
            return
        }

        mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
        mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-api', text)

        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))
    })
}

function handleDictLookup(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8').trim()
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
        mgr.focusOrCreate(WindowLabel.DICT, get_dict_window_options())
        mgr.sendWhenReady(WindowLabel.DICT, 'dict:lookup', trimmed)
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
        ;(async () => {
            try {
                const body = Buffer.concat(chunks).toString('utf-8').trim()
                let textToUse: string | null = null
                let method = 'e2e'

                // E2E text injection: if JSON body has text field, use it
                if (body) {
                    try {
                        const json = parse_json_body(chunks)
                        const body_text = json.text
                        if (typeof body_text === 'string' && body_text.trim()) {
                            textToUse = body_text
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
        })().catch((err: unknown) => { log_server.error(err) })
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
                    const json = parse_json_body(chunks)
                    if (typeof json.text === 'string') text = json.text
                } catch { /* ignore */ }
            }
            if (!text.trim()) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'empty text' }))
                return
            }
            mgr.focusOrCreate(WindowLabel.DICT, get_dict_window_options())
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
                    const json = parse_json_body(chunks)
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
                    const json = parse_json_body(chunks)
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
    ;(async () => {
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

            const first_source = sources.at(0)
            if (!first_source) {
                res.writeHead(500)
                res.end(JSON.stringify({ success: false, error: 'no screen source' }))
                return
            }

            const thumb = first_source.thumbnail
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
    })().catch((err: unknown) => { log_server.error(err) })
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
            const body = parse_json_body(chunks)
            const label = typeof body.label === 'string' ? body.label : ''
            if (!label) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'missing label' }))
                return
            }

            const windowOpts: Partial<Record<string, ReturnType<typeof get_translate_window_options>>> = {
                dict: { label: WindowLabel.DICT, width: 350, height: 420 },
                config: { label: WindowLabel.CONFIG, width: 880, height: 600 },
                recognize: get_recognize_window_options(),
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

function handleSetConfig(req: http.IncomingMessage, res: http.ServerResponse): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        try {
            const body = parse_json_body(chunks)
            const results: Record<string, boolean> = {}
            for (const [key, value] of Object.entries(body)) {
                try {
                    setConfig(key as keyof typeof DEFAULT_CONFIG, value)
                    results[key] = true
                } catch {
                    results[key] = false
                }
            }
            res.writeHead(200)
            res.end(JSON.stringify({ success: true, results }))
        } catch (error: unknown) {
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(error) }))
        }
    })
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
        res.end(JSON.stringify({ success: true, label, exists: false, visible: false, focused: false, alwaysOnTop: false, transparent: false, bounds: null }))
        return
    }

    res.writeHead(200)
    res.end(JSON.stringify({
        success: true,
        label,
        exists: true,
        visible: win.isVisible(),
        focused: win.isFocused(),
        alwaysOnTop: win.isAlwaysOnTop(),
        transparent: mgr.isTransparent(label as WindowLabel),
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
        ;(async () => {
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
        })().catch((err: unknown) => { log_server.error(err) })
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

function handle_trigger_hotkey(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        (async () => {
            try {
                const body = parse_json_body(chunks)
                const name = typeof body.name === 'string' ? body.name : ''
                if (!name) {
                    res.writeHead(400)
                    res.end(JSON.stringify({ success: false, error: 'missing name' }))
                    return
                }
                const selectionText = typeof body.selectionText === 'string' ? body.selectionText : undefined
                if (name === 'translate') {
                    await triggerTranslateEntry(mgr, selectionText)
                    res.writeHead(200)
                    res.end(JSON.stringify({ success: true }))
                    return
                }
                if (selectionText !== undefined) {
                    setE2eSelectedTextResult({
                        text: selectionText,
                        method: 'none',
                        reason: selectionText.trim() ? undefined : 'empty'
                    })
                }
                if (!hasRegisteredHotkey(name)) {
                    res.writeHead(404)
                    res.end(JSON.stringify({ success: false, error: 'hotkey not registered' }))
                    return
                }
                triggerRegisteredHotkey(name)
                res.writeHead(200)
                res.end(JSON.stringify({ success: true }))
            } catch (error: unknown) {
                res.writeHead(500)
                res.end(JSON.stringify({ success: false, error: String(error) }))
            }
        })().catch((error: unknown) => {
            log_server.error(error)
            if (!res.headersSent) {
                res.writeHead(500)
                res.end(JSON.stringify({ success: false, error: String(error) }))
            }
        })
    })
}

function handle_hotkey_system_failures(
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
        try {
            const body = parse_json_body(chunks)
            const shortcuts = Array.isArray(body.shortcuts)
                ? body.shortcuts.filter((shortcut): shortcut is string => typeof shortcut === 'string')
                : []
            setE2eHotkeySystemFailures(shortcuts)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
        } catch (error: unknown) {
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(error) }))
        }
    })
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

function handle_tray_menu(res: http.ServerResponse): void {
    try {
        res.writeHead(200)
        res.end(JSON.stringify({ success: true, labels: get_tray_menu_labels() }))
    } catch (error: unknown) {
        res.writeHead(500)
        res.end(JSON.stringify({ success: false, error: String(error) }))
    }
}

function parse_mock_update_assets(value: unknown): Array<{ name: string; url: string }> {
    if (!Array.isArray(value)) return []
    return value.flatMap((asset) => {
        if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return []
        const record = asset as Record<string, unknown>
        return typeof record.name === 'string' && typeof record.url === 'string'
            ? [{ name: record.name, url: record.url }]
            : []
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
                assets: parse_mock_update_assets(body.assets),
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
