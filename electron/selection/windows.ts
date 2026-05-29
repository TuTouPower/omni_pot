import koffi from 'koffi'
import type { SelectedTextResult } from './index'
import { getSelectedTextViaClipboard } from './clipboard'
import { withClipboardMutationSuppressed } from '../clipboard/index'

const user32 = koffi.load('user32.dll')
const ole32 = koffi.load('ole32.dll')
const oleaut32 = koffi.load('oleaut32.dll')

const INPUT_KEYBOARD = 1
const KEYEVENTF_KEYUP = 0x0002
const VK_CONTROL = 0x11
const VK_C = 0x43

const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
    wVk: 'uint16',
    wScan: 'uint16',
    dwFlags: 'uint32',
    time: 'uint32',
    dwExtraInfo: 'uint64'
})

const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
    dx: 'int32',
    dy: 'int32',
    mouseData: 'uint32',
    dwFlags: 'uint32',
    time: 'uint32',
    dwExtraInfo: 'uint64'
})

const HARDWAREINPUT = koffi.struct('HARDWAREINPUT', {
    uMsg: 'uint32',
    wParamL: 'uint16',
    wParamH: 'uint16'
})

const INPUT_UNION = koffi.union('INPUT_UNION', {
    ki: KEYBDINPUT,
    mi: MOUSEINPUT,
    hi: HARDWAREINPUT
})

const INPUT_STRUCT = koffi.struct('INPUT', {
    type: 'uint32',
    u: INPUT_UNION
})

const SendInput = user32.func(
    'unsigned int __stdcall SendInput(unsigned int cInputs, INPUT *pInputs, int cbSize)'
) as unknown as (c_inputs: number, inputs: unknown, cb_size: number) => number

function sendCtrlC(): Promise<void> {
    const inputs = [
        { type: INPUT_KEYBOARD, u: { ki: { wVk: VK_CONTROL, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0n } } },
        { type: INPUT_KEYBOARD, u: { ki: { wVk: VK_C, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0n } } },
        { type: INPUT_KEYBOARD, u: { ki: { wVk: VK_C, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0n } } },
        { type: INPUT_KEYBOARD, u: { ki: { wVk: VK_CONTROL, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0n } } }
    ]

    const sent = SendInput(4, inputs, koffi.sizeof(INPUT_STRUCT))
    if (sent !== 4) {
        throw new Error(`SendInput failed: ${String(sent)}/4 events delivered`)
    }
    return Promise.resolve()
}

const S_OK = 0
const S_FALSE = 1
const RPC_E_CHANGED_MODE = -2147417850
const COINIT_APARTMENTTHREADED = 0x2
const CLSCTX_INPROC_SERVER = 0x1
const UIA_TextPatternId = 10014

koffi.struct('GUID', {
    Data1: 'uint32',
    Data2: 'uint16',
    Data3: 'uint16',
    Data4: 'uint8[8]'
})

const CLSID_CUIAutomation = {
    Data1: 0xff48dba4,
    Data2: 0x60ef,
    Data3: 0x4201,
    Data4: [0xaa, 0x87, 0x54, 0x10, 0x3e, 0xef, 0x59, 0x4e]
}

const IID_IUIAutomation = {
    Data1: 0x30cbe57d,
    Data2: 0xd9d0,
    Data3: 0x452a,
    Data4: [0xab, 0x13, 0x7a, 0xc5, 0xac, 0x48, 0x25, 0xee]
}

type NativePointer = object
type NativeProto = Parameters<typeof koffi.call>[1]

const CoInitializeEx = ole32.func(
    'int32 __stdcall CoInitializeEx(void *pvReserved, uint32 dwCoInit)'
) as unknown as (reserved: null, co_init: number) => number
const CoCreateInstance = ole32.func(
    'int32 __stdcall CoCreateInstance(GUID *rclsid, void *pUnkOuter, uint32 dwClsCtx, GUID *riid, _Out_ void **ppv)'
) as unknown as (clsid: unknown, outer: null, cls_context: number, iid: unknown, out: Array<NativePointer | null>) => number
const CoUninitialize = ole32.func('void __stdcall CoUninitialize()') as unknown as () => void
const SysFreeString = oleaut32.func('void __stdcall SysFreeString(wchar_t *bstrString)') as unknown as (value: unknown) => void

const ReleaseProto = koffi.proto('uint32 __stdcall UiaRelease(void *self)')
const GetFocusedElementProto = koffi.proto(
    'int32 __stdcall UiaGetFocusedElement(void *self, _Out_ void **element)'
)
const GetCurrentPatternProto = koffi.proto(
    'int32 __stdcall UiaGetCurrentPattern(void *self, int32 patternId, _Out_ void **pattern)'
)
const GetSelectionProto = koffi.proto(
    'int32 __stdcall UiaGetSelection(void *self, _Out_ void **ranges)'
)
const GetLengthProto = koffi.proto(
    'int32 __stdcall UiaGetLength(void *self, _Out_ int32 *length)'
)
const GetElementProto = koffi.proto(
    'int32 __stdcall UiaGetElement(void *self, int32 index, _Out_ void **range)'
)
const GetTextProto = koffi.proto(
    'int32 __stdcall UiaGetText(void *self, int32 maxLength, _Out_ wchar_t **text)'
)

function readVtableFunc(obj: NativePointer, index: number): NativePointer {
    const vtablePtr = koffi.decode(obj, 'void *') as NativePointer
    const funcPtrs = koffi.decode(vtablePtr, 'void *', index + 1) as NativePointer[]
    const fn = funcPtrs.at(index)
    if (fn === undefined) throw new Error('Missing COM vtable function')
    return fn
}

function call_i32(fn: NativePointer, proto: NativeProto, ...args: unknown[]): number {
    return koffi.call(fn, proto, ...args) as number
}

function call_u32(fn: NativePointer, proto: NativeProto, ...args: unknown[]): number {
    return koffi.call(fn, proto, ...args) as number
}

function release(obj: NativePointer): void {
    const fn = readVtableFunc(obj, 2)
    call_u32(fn, ReleaseProto, obj)
}

function getTextByUIAutomation(): string | null {
    const hr = CoInitializeEx(null, COINIT_APARTMENTTHREADED)
    if (hr === RPC_E_CHANGED_MODE) {
        return null
    }
    if (hr !== S_OK && hr !== S_FALSE) {
        return null
    }

    let pAutomation: NativePointer | null = null
    let pElement: NativePointer | null = null
    let pPattern: NativePointer | null = null
    let pRanges: NativePointer | null = null

    try {
        const ppv: Array<NativePointer | null> = [null]
        const hr2 = CoCreateInstance(
            CLSID_CUIAutomation, null, CLSCTX_INPROC_SERVER, IID_IUIAutomation, ppv
        )
        if (hr2 !== S_OK || !ppv[0]) {
            return null
        }
        pAutomation = ppv[0]

        const elementOut: Array<NativePointer | null> = [null]
        const hr3 = call_i32(
            readVtableFunc(pAutomation, 8), GetFocusedElementProto, pAutomation, elementOut
        )
        if (hr3 !== S_OK || !elementOut[0]) {
            return null
        }
        pElement = elementOut[0]

        const patternOut: Array<NativePointer | null> = [null]
        const hr4 = call_i32(
            readVtableFunc(pElement, 16), GetCurrentPatternProto,
            pElement, UIA_TextPatternId, patternOut
        )
        if (hr4 !== S_OK || !patternOut[0]) {
            return null
        }
        pPattern = patternOut[0]

        const rangesOut: Array<NativePointer | null> = [null]
        const hr5 = call_i32(
            readVtableFunc(pPattern, 5), GetSelectionProto, pPattern, rangesOut
        )
        if (hr5 !== S_OK || !rangesOut[0]) {
            return null
        }
        pRanges = rangesOut[0]

        const lengthOut = [0]
        const hr6 = call_i32(
            readVtableFunc(pRanges, 3), GetLengthProto, pRanges, lengthOut
        )
        if (hr6 !== S_OK) {
            return null
        }

        const length = lengthOut[0] ?? 0
        const texts: string[] = []

        for (let i = 0; i < length; i++) {
            const rangeOut: Array<NativePointer | null> = [null]
            const hr7 = call_i32(
                readVtableFunc(pRanges, 4), GetElementProto, pRanges, i, rangeOut
            )
            if (hr7 !== S_OK || !rangeOut[0]) {
                continue
            }

            const pRange = rangeOut[0]
            const textOut: Array<NativePointer | null> = [null]
            try {
                const hr8 = call_i32(
                    readVtableFunc(pRange, 12), GetTextProto, pRange, -1, textOut
                )
                if (hr8 === S_OK && textOut[0]) {
                    const text = koffi.decode(textOut[0], 'str16') as unknown as string
                    texts.push(text)
                }
            } finally {
                if (textOut[0]) SysFreeString(textOut[0])
                release(pRange)
            }
        }

        const result = texts.join('\n').trim()
        return result.length > 0 ? result : null
    } finally {
        if (pRanges) release(pRanges)
        if (pPattern) release(pPattern)
        if (pElement) release(pElement)
        if (pAutomation) release(pAutomation)
        CoUninitialize()
    }
}

export async function readSelectedTextWindows(): Promise<SelectedTextResult> {
    const text = getTextByUIAutomation()
    if (text) {
        return { text, method: 'uia' }
    }

    return getSelectedTextViaClipboard(
        () => sendCtrlC(),
        withClipboardMutationSuppressed
    )
}
