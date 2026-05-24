import { getConfig } from '../config/store'
import { WindowLabel, type WindowOptions } from './types'
import { TRANSLATE_MIN_WIDTH } from './translate_height_controller'

const TRANSLATE_INITIAL_HEIGHT = 160
const TRANSLATE_DEFAULT_WIDTH = 430

export function get_translate_window_options(): WindowOptions {
    const remember_size = getConfig('translate_remember_window_size') as boolean
    const width = remember_size
        ? Math.max(TRANSLATE_MIN_WIDTH, getConfig('translate_window_width') as number)
        : TRANSLATE_DEFAULT_WIDTH
    return {
        label: WindowLabel.TRANSLATE,
        width,
        height: TRANSLATE_INITIAL_HEIGHT,
        minWidth: TRANSLATE_MIN_WIDTH,
        minHeight: TRANSLATE_INITIAL_HEIGHT,
        resizable: true,
        alwaysOnTop: getConfig('translate_always_on_top') as boolean,
    }
}
