const is_mac = navigator.platform ? navigator.platform.startsWith('Mac')
    : /Mac|iPhone|iPad/.test(navigator.userAgent)

function format_segment(seg: string): string {
    if (is_mac) {
        switch (seg) {
            case 'CommandOrControl':
            case 'CmdOrCtrl':
            case 'Command':
            case 'Super':
            case 'Meta':
                return 'Cmd'
            case 'Control':
                return 'Ctrl'
            case 'Alt':
                return 'Opt'
            case 'Shift':
                return 'Shift'
            default:
                return seg
        }
    }
    switch (seg) {
        case 'CommandOrControl':
        case 'CmdOrCtrl':
        case 'Command':
        case 'Control':
            return 'Ctrl'
        case 'Super':
        case 'Meta':
            return 'Win'
        case 'Alt':
            return 'Alt'
        case 'Shift':
            return 'Shift'
        default:
            return seg
    }
}

export function format_hotkey(accelerator: string): string[] {
    if (!accelerator) return []
    return accelerator.split('+').map((s) => s.trim()).filter(Boolean).map(format_segment)
}
