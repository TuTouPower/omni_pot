import type http from 'http'
import { clipboard } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { get_translate_window_options } from '../windows/translate_options'
import { get_dict_window_options } from '../windows/dict_options'
import { hasRegisteredHotkey, triggerRegisteredHotkey, setE2eHotkeySystemFailures, triggerTranslateEntry } from '../hotkey'
import { readSelectedText, setE2eSelectedTextResult } from '../selection'
import { log } from '../log'
import { BodyTooLargeError, readBody, respondBodyTooLarge, parse_json_body } from './body'

const log_server = log.scope('server')

export function handleTriggerSelection(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = buf.toString('utf-8').trim()
            let textToUse: string | null = null
            let method = 'e2e'

            // E2E text injection: if JSON body has text field, use it
            if (body) {
                try {
                    const json = parse_json_body(buf)
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
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}

export function handleTriggerDict(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = buf.toString('utf-8').trim()
            let text = ''
            if (body) {
                try {
                    const json = parse_json_body(buf)
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
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}

export function handleTriggerClipboard(
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = buf.toString('utf-8').trim()
            let text = ''
            if (body) {
                try {
                    const json = parse_json_body(buf)
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
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}

export function handleTriggerClipboardTranslate(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = buf.toString('utf-8').trim()
            let text = ''
            if (body) {
                try {
                    const json = parse_json_body(buf)
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
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}

export function handle_trigger_hotkey(
    mgr: WindowManager,
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = parse_json_body(buf)
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
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((error: unknown) => {
        log_server.error(error)
        if (!res.headersSent) {
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(error) }))
        }
    })
}

export function handle_hotkey_system_failures(
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    ;(async () => {
        try {
            const buf = await readBody(req)
            const body = parse_json_body(buf)
            const shortcuts = Array.isArray(body.shortcuts)
                ? body.shortcuts.filter((shortcut): shortcut is string => typeof shortcut === 'string')
                : []
            setE2eHotkeySystemFailures(shortcuts)
            res.writeHead(200)
            res.end(JSON.stringify({ success: true }))
        } catch (err: unknown) {
            if (err instanceof BodyTooLargeError) { respondBodyTooLarge(res); return; }
            res.writeHead(500)
            res.end(JSON.stringify({ success: false, error: String(err) }))
        }
    })().catch((err: unknown) => { log_server.error(err) })
}
