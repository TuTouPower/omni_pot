import http from 'http'
import { app, clipboard } from 'electron'
import { setConfig, resetConfigToDefaults } from '../config/store'
import { DEFAULT_CONFIG, type ConfigKey } from '@shared/types/config'
import { is_config_value_allowed } from '../config/validation'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { get_translate_window_options } from '../windows/translate_options'
import { trigger_tray_action, get_tray_menu_labels } from '../tray'
import { add_history } from '../history'
import type { HistoryRecord } from '@shared/types/ipc'
import { log } from '../log'
import { bind_update_release_assets } from '../updater'
import { BodyTooLargeError, readBody, respondBodyTooLarge, parse_json_body } from './body'

const log_server = log.scope('server')

export function handleResetConfig(res: http.ServerResponse): void {
    try {
        resetConfigToDefaults()
        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))
    } catch (error: unknown) {
        res.writeHead(500)
        res.end(JSON.stringify({ success: false, error: String(error) }))
    }
}

export function handleSetConfig(req: http.IncomingMessage, res: http.ServerResponse): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = parse_json_body(buf)
            const results: Record<string, boolean> = {}
            for (const [key, value] of Object.entries(body)) {
                try {
                    if (!(key in DEFAULT_CONFIG) || !is_config_value_allowed(key as ConfigKey, value)) {
                        results[key] = false
                        continue
                    }
                    setConfig(key as ConfigKey, value)
                    results[key] = true
                } catch {
                    results[key] = false
                }
            }
            res.writeHead(200)
            res.end(JSON.stringify({ success: true, results }))
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}

export function handleReadClipboard(res: http.ServerResponse): void {
    try {
        const text = clipboard.readText()
        res.writeHead(200)
        res.end(JSON.stringify({ success: true, text }))
    } catch (error: unknown) {
        res.writeHead(500)
        res.end(JSON.stringify({ success: false, error: String(error) }))
    }
}

export function handle_read_clipboard_image(res: http.ServerResponse): void {
    try {
        const image = clipboard.readImage()
        const size = image.getSize()
        res.writeHead(200)
        res.end(JSON.stringify({ success: true, is_empty: image.isEmpty(), size }))
    } catch (error: unknown) {
        res.writeHead(500)
        res.end(JSON.stringify({ success: false, error: String(error) }))
    }
}

function is_history_record_seed(record: Record<string, unknown>): record is Omit<HistoryRecord, 'id' | 'created_at'> {
    return typeof record.service_key === 'string'
        && typeof record.source_text === 'string'
        && typeof record.source_lang === 'string'
        && typeof record.target_text === 'string'
        && typeof record.target_lang === 'string'
}

export function handle_add_history(
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = parse_json_body(buf)
            if (!is_history_record_seed(body)) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'invalid history record' }))
                return
            }
            add_history(body)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}

export function handle_trigger_input_translate(
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

export function handle_tray_action(
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = parse_json_body(buf)
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
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}

export function handle_tray_menu(res: http.ServerResponse): void {
    try {
        res.writeHead(200)
        res.end(JSON.stringify({ success: true, labels: get_tray_menu_labels() }))
    } catch (error: unknown) {
        res.writeHead(500)
        res.end(JSON.stringify({ success: false, error: String(error) }))
    }
}

function parse_mock_update_assets(value: unknown): Array<{ name: string; url: string; size?: number; digest?: string }> {
    if (!Array.isArray(value)) return []
    return value.flatMap((asset) => {
        if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return []
        const record = asset as Record<string, unknown>
        return typeof record.name === 'string' && typeof record.url === 'string'
            ? [{ name: record.name, url: record.url, size: typeof record.size === 'number' ? record.size : undefined, digest: typeof record.digest === 'string' ? record.digest : undefined }]
            : []
    })
}

export function handle_mock_update(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = parse_json_body(buf)
            const release = {
                version: typeof body.version === 'string' ? body.version : '9.9.9',
                current_version: typeof body.current_version === 'string' ? body.current_version : app.getVersion(),
                name: typeof body.name === 'string' ? body.name : 'E2E Release',
                body: typeof body.body === 'string' ? body.body : 'E2E changelog',
                html_url: typeof body.html_url === 'string' ? body.html_url : '',
                published_at: typeof body.published_at === 'string' ? body.published_at : '1970-01-01T00:00:00.000Z',
                assets: parse_mock_update_assets(body.assets),
            }

            bind_update_release_assets(release.assets)
            mgr.focusOrCreate(WindowLabel.UPDATER, {
                label: WindowLabel.UPDATER,
                width: 480,
                height: 520,
                resizable: true,
            })
            mgr.sendWhenReady(WindowLabel.UPDATER, 'updater:release', release)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true, release }))
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}
