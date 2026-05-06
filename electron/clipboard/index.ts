import { clipboard } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'

const TRANSLATE_OPTS = {
    label: WindowLabel.TRANSLATE,
    width: 350,
    height: 420
}

let last_text = ''
let interval_id: ReturnType<typeof setInterval> | null = null
let enabled = false

export function startClipboardMonitor(mgr: WindowManager): void {
    if (interval_id) return
    enabled = true
    last_text = clipboard.readText()
    interval_id = setInterval(() => {
        if (!enabled) return
        const current = clipboard.readText()
        if (current !== last_text && current.trim()) {
            last_text = current
            const win = mgr.focusOrCreate(WindowLabel.TRANSLATE, TRANSLATE_OPTS)
            win.webContents.send('translate:from-clipboard', current)
        }
    }, 500)
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
