import http from 'http'
import { desktopCapturer, screen } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { get_translate_window_options } from '../windows/translate_options'
import { get_recognize_window_options } from '../windows/recognize_options'
import { get_welcome_window_options } from '../windows/welcome_options'
import { start_screenshot_capture } from '../screenshot'
import { log } from '../log'
import { BodyTooLargeError, readBody, respondBodyTooLarge, parse_json_body, MAX_OCR_BODY_SIZE } from './body'

const log_server = log.scope('server')

export function handleCaptureClock(res: http.ServerResponse): void {
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

export function handleOpenWindow(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = parse_json_body(buf)
            const label = typeof body.label === 'string' ? body.label : ''
            if (!label) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'missing label' }))
                return
            }

            const windowOpts: Partial<Record<string, ReturnType<typeof get_translate_window_options>>> = {
                welcome: get_welcome_window_options(),
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
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}

export function handleWindowState(
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

export function handle_window_display(
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
        res.writeHead(404)
        res.end(JSON.stringify({ success: false, error: `missing window: ${label}` }))
        return
    }

    const display = screen.getDisplayMatching(win.getBounds())
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, label, workArea: display.workArea }))
}

export function handle_primary_display(res: http.ServerResponse): void {
    const display = screen.getPrimaryDisplay()
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, workArea: display.workArea }))
}

export function handle_trigger_screenshot(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req, MAX_OCR_BODY_SIZE)
            const body = parse_json_body(buf)
            const mode = body.mode === 'translate' ? 'translate' : 'recognize'
            const success = await start_screenshot_capture(mgr, mode)
            res.writeHead(success ? 200 : 500)
            res.end(JSON.stringify(success ? { success: true, mode } : { success: false, error: 'screenshot capture failed' }))
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}

export function handle_open_recognize(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req, MAX_OCR_BODY_SIZE)
            const body = parse_json_body(buf)
            const image = typeof body.image === 'string' ? body.image : ''
            const text = typeof body.text === 'string' ? body.text : ''
            const mode = body.mode === 'translate' ? 'translate' : 'recognize'
            if (!image) {
                res.writeHead(400)
                res.end(JSON.stringify({ success: false, error: 'missing image' }))
                return
            }
            mgr.focusOrCreate(WindowLabel.RECOGNIZE, get_recognize_window_options())
            mgr.sendWhenReady(WindowLabel.RECOGNIZE, 'recognize:show', image, text, mode)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true, mode }))
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}
