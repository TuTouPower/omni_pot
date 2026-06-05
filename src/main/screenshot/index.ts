import { desktopCapturer, screen, type BrowserWindow, type Display } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { log } from '../log'

export function get_screenshot_display(): Display {
    return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

export async function capture_screenshot(display: Display = get_screenshot_display()): Promise<string> {
    log.info('[screenshot] capture_screenshot: start')
    const { width, height } = display.size
    const scale_factor = display.scaleFactor

    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
            width: Math.round(width * scale_factor),
            height: Math.round(height * scale_factor)
        }
    })

    const source = sources.find((item) => item.display_id === String(display.id)) ?? sources.at(0)
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
    const display = get_screenshot_display()
    const { width, height } = display.size
    const win = manager.createWindow(get_screenshot_window_options(width, height, false))
    win.setBounds({ x: display.bounds.x, y: display.bounds.y, width, height })

    // Warm up the desktop capturer pipeline.
    // On Windows, the first call to desktopCapturer.getSources() initialises
    // the DXGI capture infrastructure and can block for 1-3 seconds.
    // Doing it here (async, fire-and-forget) hides this cost during the
    // user's first screenshot trigger.
    desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })
        .then(() => { log.info('[screenshot] preload: capturer warm-up complete') })
        .catch((err: unknown) => { log.warn('[screenshot] preload: capturer warm-up failed:', err) })
}

export async function start_screenshot_capture(
    manager: WindowManager,
    mode: 'recognize' | 'translate'
): Promise<boolean> {
    let win: BrowserWindow | null = null
    try {
        const display = get_screenshot_display()
        const { width, height } = display.size
        const base64 = await capture_screenshot(display)

        win = manager.focusOrCreate(WindowLabel.SCREENSHOT, get_screenshot_window_options(width, height, true))
        win.setBounds({ x: display.bounds.x, y: display.bounds.y, width, height })
        win.show()
        win.focus()

        log.info('[screenshot] sending screenshot:show, base64 length =', base64.length, 'mode =', mode)
        manager.sendWhenReady(WindowLabel.SCREENSHOT, 'screenshot:show', base64, mode)
        return true
    } catch (err) {
        log.error('[screenshot] capture failed:', err instanceof Error ? err.message : String(err))
        win?.close()
        return false
    }
}
