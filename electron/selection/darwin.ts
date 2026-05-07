import koffi from 'koffi'
import { execFile } from 'child_process'
import type { SelectedTextResult } from './index'
import { getSelectedTextViaClipboard } from './clipboard'
import { withClipboardMutationSuppressed } from '../clipboard/index'
import { checkAccessibilityPermission } from './permissions'

const objc = koffi.load('/usr/lib/libobjc.A.dylib')
const appService = koffi.load(
    '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices'
)
const coreFoundation = koffi.load(
    '/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation'
)

const objc_getClass = objc.func('void *objc_getClass(const char *name)')
const sel_registerName = objc.func('void *sel_registerName(const char *name)')
const objc_msgSend = objc.func('void *objc_msgSend(void *self, void *cmd)')
const objc_msgSend_int = objc.func('int objc_msgSend(void *self, void *cmd)')

const AXUIElementCreateApplication = appService.func(
    'void *AXUIElementCreateApplication(int pid)'
)
const AXUIElementCopyAttributeValue = appService.func(
    'int32_t AXUIElementCopyAttributeValue(void *element, void *attribute, _Out_ void **value)'
)

const CFStringCreateWithCString = coreFoundation.func(
    'void *CFStringCreateWithCString(void *alloc, const char *cStr, uint32_t encoding)'
)
const CFStringGetCString = coreFoundation.func(
    'bool CFStringGetCString(void *theString, char *buffer, long bufferSize, uint32_t encoding)'
)
const CFRelease = coreFoundation.func('void CFRelease(void *cf)')

const kCFStringEncodingUTF8 = 0x08000100

function msgSend(obj: unknown, sel: unknown): unknown {
    return objc_msgSend(obj as any, sel as any)
}

function msgSendInt(obj: unknown, sel: unknown): number {
    return objc_msgSend_int(obj as any, sel as any)
}

function getFrontmostAppPid(): number | null {
    const nsWorkspace = objc_getClass('NSWorkspace')
    const sharedWS = msgSend(nsWorkspace, sel_registerName('sharedWorkspace'))
    if (!sharedWS) return null

    const frontApp = msgSend(sharedWS, sel_registerName('frontmostApplication'))
    if (!frontApp) return null

    return msgSendInt(frontApp, sel_registerName('processIdentifier'))
}

function getTextByAccessibility(): string | null {
    const pid = getFrontmostAppPid()
    if (pid === null || pid === 0) return null

    const appElement = AXUIElementCreateApplication(pid)
    if (!appElement) return null

    const attrFocused = CFStringCreateWithCString(
        null, 'AXFocusedUIElementAttribute', kCFStringEncodingUTF8
    )
    if (!attrFocused) return null

    try {
        const focusedOut = [null]
        const hr = AXUIElementCopyAttributeValue(appElement, attrFocused, focusedOut)
        if (hr !== 0 || !focusedOut[0]) return null

        const focusedElement = focusedOut[0]

        const attrSelected = CFStringCreateWithCString(
            null, 'AXSelectedTextAttribute', kCFStringEncodingUTF8
        )
        if (!attrSelected) {
            CFRelease(focusedElement)
            return null
        }

        try {
            const textOut = [null]
            const hr2 = AXUIElementCopyAttributeValue(focusedElement, attrSelected, textOut)
            if (hr2 !== 0 || !textOut[0]) return null

            const cfText = textOut[0]
            try {
                const buffer = Buffer.alloc(4096)
                const ok = CFStringGetCString(cfText, buffer, buffer.length, kCFStringEncodingUTF8)
                if (!ok) return null

                const text = buffer.readCString(0).trim()
                return text.length > 0 ? text : null
            } finally {
                CFRelease(cfText)
            }
        } finally {
            CFRelease(attrSelected)
        }
    } finally {
        CFRelease(attrFocused)
    }
}

async function sendCommandCByAppleScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        execFile(
            'osascript',
            ['-e', 'tell application "System Events" to keystroke "c" using command down'],
            { timeout: 5000 },
            (err) => {
                if (err) reject(err)
                else resolve()
            }
        )
    })
}

export async function readSelectedTextDarwin(): Promise<SelectedTextResult> {
    const permission = checkAccessibilityPermission()
    if (!permission.trusted) {
        return { text: '', method: 'none', reason: 'permission-denied' }
    }

    const text = getTextByAccessibility()
    if (text) return { text, method: 'accessibility' }

    return getSelectedTextViaClipboard(
        () => sendCommandCByAppleScript(),
        withClipboardMutationSuppressed
    )
}
