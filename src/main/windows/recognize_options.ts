import { getConfig } from '../config/store'
import { WindowLabel, type WindowOptions } from './types'

const RECOGNIZE_MIN_WIDTH = 600
const RECOGNIZE_MIN_HEIGHT = 420

export function get_recognize_window_options(): WindowOptions {
    const remember_size = getConfig('recognize_remember_window_size') as boolean
    const width = remember_size ? (getConfig('recognize_window_width') as number) : 860
    const height = remember_size ? (getConfig('recognize_window_height') as number) : 520
    return {
        label: WindowLabel.RECOGNIZE,
        width: Math.max(width, RECOGNIZE_MIN_WIDTH),
        height: Math.max(height, RECOGNIZE_MIN_HEIGHT),
        minWidth: RECOGNIZE_MIN_WIDTH,
        minHeight: RECOGNIZE_MIN_HEIGHT,
        alwaysOnTop: getConfig('recognize_always_on_top') as boolean,
    }
}
