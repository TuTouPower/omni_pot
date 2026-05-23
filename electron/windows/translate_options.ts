import type { BrowserWindow } from 'electron'
import { getConfig, setConfig } from '../config/store'
import { WindowLabel, type WindowOptions } from './types'

const TRANSLATE_MIN_WIDTH = 280
const TRANSLATE_MIN_HEIGHT = 320

export function get_translate_window_options(): WindowOptions {
    const remember_size = getConfig('translate_remember_window_size') as boolean
    const width = remember_size ? (getConfig('translate_window_width') as number) : 430
    const height = remember_size ? (getConfig('translate_window_height') as number) : 360
    return {
        label: WindowLabel.TRANSLATE,
        width: Math.max(width, TRANSLATE_MIN_WIDTH),
        height: Math.max(height, TRANSLATE_MIN_HEIGHT),
        minWidth: TRANSLATE_MIN_WIDTH,
        minHeight: TRANSLATE_MIN_HEIGHT,
        maxHeight: 960,
        alwaysOnTop: getConfig('translate_always_on_top') as boolean,
    }
}

let resizeTimer: ReturnType<typeof setTimeout> | null = null

export function attach_translate_resize_persistence(win: BrowserWindow): void {
    if (!getConfig('translate_remember_window_size') || win.listenerCount('resize')) return
    win.on('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
            if (win.isDestroyed()) { resizeTimer = null; return }
            const [width, height] = win.getSize()
            setConfig('translate_window_width', width)
            setConfig('translate_window_height', height)
            resizeTimer = null
        }, 300)
    })
}
