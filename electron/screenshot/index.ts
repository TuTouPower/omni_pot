import { desktopCapturer, screen, type BrowserWindow } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { log } from '../log'

export async function capture_screenshot(): Promise<string> {
    log.info('[screenshot] capture_screenshot: start')
    const primary_display = screen.getPrimaryDisplay()
    const { width, height } = primary_display.size
    const scale_factor = primary_display.scaleFactor

    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
            width: Math.round(width * scale_factor),
            height: Math.round(height * scale_factor)
        }
    })

    const source = sources.find((item) => item.display_id === String(primary_display.id)) ?? sources.at(0)
    if (!source) {
        throw new Error('No screen source available')
    }

    const thumbnail = source.thumbnail
    const base64 = thumbnail.toPNG().toString('base64')
    log.info('[screenshot] capture_screenshot: done, base64 length =', base64.length)
    return base64
}

function get_screenshot_window_options(width: number, height: number, show: boolean) {
    return {
        label: WindowLabel.SCREENSHOT,
        width,
        height,
        transparent: true,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        show
    }
}

export function preload_screenshot_window(manager: WindowManager): void {
    const display = screen.getPrimaryDisplay()
    const { width, height } = display.size
    const win = manager.createWindow(get_screenshot_window_options(width, height, false))
    win.setBounds({ x: display.bounds.x, y: display.bounds.y, width, height })
}

export async function start_screenshot_capture(
    manager: WindowManager,
    mode: 'recognize' | 'translate'
): Promise<boolean> {
    let win: BrowserWindow | null = null
    try {
        const display = screen.getPrimaryDisplay()
        const { width, height } = display.size

        // Capture the desktop before showing the screenshot window,
        // so the overlay window itself is never included in the capture.
        const base64 = await capture_screenshot()

        win = manager.focusOrCreate(WindowLabel.SCREENSHOT, get_screenshot_window_options(width, height, true))
        win.setBounds({ x: display.bounds.x, y: display.bounds.y, width, height })
        win.show()
        win.focus()

        log.info('[screenshot] sending screenshot:show, base64 length =', base64.length, 'mode =', mode)
        manager.sendWhenReady(WindowLabel.SCREENSHOT, 'screenshot:show', base64, mode)
        return true
    } catch {
        win?.close()
        return false
    }
}
