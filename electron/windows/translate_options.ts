import type { BrowserWindow } from 'electron'
import { getConfig, setConfig } from '../config/store'
import { WindowLabel, type WindowOptions } from './types'

export function get_translate_window_options(): WindowOptions {
    const remember_size = getConfig('translate_remember_window_size') as boolean
    return {
        label: WindowLabel.TRANSLATE,
        width: remember_size ? (getConfig('translate_window_width') as number) : 430,
        height: remember_size ? (getConfig('translate_window_height') as number) : 360,
        minWidth: 430,
        minHeight: 240,
        alwaysOnTop: getConfig('translate_always_on_top') as boolean,
    }
}

export function attach_translate_resize_persistence(win: BrowserWindow): void {
    if (!getConfig('translate_remember_window_size') || win.listenerCount('resize')) return
    win.on('resize', () => {
        const [width, height] = win.getSize()
        setConfig('translate_window_width', width)
        setConfig('translate_window_height', height)
    })
}
