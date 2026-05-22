import { clipboard } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { get_translate_window_options } from '../windows/translate_options'
import { log } from '../log'

const log_clipboard = log.scope('clipboard')

let last_text = ''
let interval_id: ReturnType<typeof setInterval> | null = null
let enabled = false
let suppressUntil = 0

export async function withClipboardMutationSuppressed<T>(fn: () => Promise<T>): Promise<T> {
    suppressUntil = Date.now() + 1000
    try {
        return await fn()
    } finally {
        suppressUntil = Date.now() + 200
    }
}

export function pollClipboardMonitorOnce(mgr: WindowManager): void {
    if (!enabled) return
    if (Date.now() < suppressUntil) return

    const current = clipboard.readText()

    if (current !== last_text && current.trim()) {
        last_text = current
        log_clipboard.info('monitor triggered: text=%s', current.slice(0, 50))
        mgr.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())
        mgr.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-clipboard', current)
    }
}

export function startClipboardMonitor(mgr: WindowManager): void {
    if (interval_id) return
    enabled = true
    last_text = clipboard.readText()
    interval_id = setInterval(() => { pollClipboardMonitorOnce(mgr); }, 500)
}

export function stopClipboardMonitor(): void {
    if (interval_id) {
        clearInterval(interval_id)
        interval_id = null
    }
    enabled = false
}

export function isClipboardMonitoring(): boolean {
    return enabled
}
