import { WindowLabel, type WindowOptions } from './types'

export function get_recognize_window_options(): WindowOptions {
    return {
        label: WindowLabel.RECOGNIZE,
        width: 860,
        height: 520,
        minWidth: 600,
        minHeight: 420,
    }
}
