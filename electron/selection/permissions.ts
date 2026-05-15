import koffi from 'koffi'
import { execFile } from 'child_process'

const appService = koffi.load(
    '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices'
)

const AXIsProcessTrusted = appService.func('bool AXIsProcessTrusted()') as unknown as () => boolean

export interface PermissionStatus {
    trusted: boolean
}

export function checkAccessibilityPermission(prompt?: boolean): PermissionStatus {
    const trusted = AXIsProcessTrusted()
    if (!trusted && prompt) {
        execFile('open', [
            'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
        ], (err) => {
            if (err) {
                // best-effort: ignore errors opening system preferences
            }
        })
    }
    return { trusted }
}
