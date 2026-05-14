import { desktopCapturer, screen } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'

export async function capture_screenshot(manager: WindowManager): Promise<string> {
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

    if (sources.length === 0) {
        throw new Error('No screen source available')
    }

    const thumbnail = sources[0].thumbnail
    return thumbnail.toPNG().toString('base64')
}

export async function start_screenshot_capture(
    manager: WindowManager,
    mode: 'recognize' | 'translate'
): Promise<boolean> {
    try {
        const base64 = await capture_screenshot(manager)

        const display = screen.getPrimaryDisplay()
        const { width, height } = display.size

        const win = manager.focusOrCreate(WindowLabel.SCREENSHOT, {
            label: WindowLabel.SCREENSHOT,
            width,
            height,
            transparent: true,
            frame: false,
            resizable: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            show: false
        })

        win.setBounds({ x: display.bounds.x, y: display.bounds.y, width, height })
        manager.sendWhenReady(WindowLabel.SCREENSHOT, 'screenshot:show', base64, mode)
        win.show()
        return true
    } catch {
        return false
    }
}
