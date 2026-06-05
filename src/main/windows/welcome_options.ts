import { WindowLabel, type WindowOptions } from './types'

export function get_welcome_window_options(): WindowOptions {
    return {
        label: WindowLabel.WELCOME,
        width: 520,
        height: 360,
        minWidth: 520,
        minHeight: 320,
        resizable: false,
    }
}
