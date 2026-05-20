import { getConfig } from '../config/store'
import { WindowLabel, type WindowOptions } from './types'

const DICT_MIN_WIDTH = 280
const DICT_MIN_HEIGHT = 320

export function get_dict_window_options(): WindowOptions {
    const remember_size = getConfig('translate_remember_window_size') as boolean
    const width = remember_size ? (getConfig('translate_window_width') as number) : 350
    const height = remember_size ? (getConfig('translate_window_height') as number) : 420
    return {
        label: WindowLabel.DICT,
        width: Math.max(width, DICT_MIN_WIDTH),
        height: Math.max(height, DICT_MIN_HEIGHT),
        minWidth: DICT_MIN_WIDTH,
        minHeight: DICT_MIN_HEIGHT,
        maxHeight: 960,
        alwaysOnTop: getConfig('dict_always_on_top') as boolean,
    }
}
