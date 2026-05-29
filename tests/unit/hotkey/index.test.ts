import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WindowManager } from '../../../electron/windows/manager'

const read_selected_text = vi.fn()
const focus_or_create = vi.fn()
const send_when_ready = vi.fn()
const translate_options = { label: 'translate', width: 390, height: 160 }
const dict_options = { label: 'dict', width: 350, height: 420 }

vi.mock('electron', () => ({
    globalShortcut: {
        register: vi.fn(() => true),
        unregister: vi.fn(),
        unregisterAll: vi.fn(),
        isRegistered: vi.fn(() => false),
    },
}))

vi.mock('../../../electron/selection', () => ({
    readSelectedText: read_selected_text,
}))

vi.mock('../../../electron/windows/translate_options', () => ({
    get_translate_window_options: () => translate_options,
}))

vi.mock('../../../electron/windows/dict_options', () => ({
    get_dict_window_options: () => dict_options,
}))

beforeEach(() => {
    vi.clearAllMocks()
})

describe('translate hotkey entry', () => {
    it('opens translate window before selected text lookup finishes', async () => {
        let resolve_selection: (value: { text: string; method: 'clipboard'; reason: 'copy-failed' }) => void = () => {}
        read_selected_text.mockReturnValueOnce(new Promise((resolve) => { resolve_selection = resolve }))
        const manager = {
            focusOrCreate: focus_or_create,
            sendWhenReady: send_when_ready,
        } as unknown as WindowManager
        const { triggerTranslateEntry } = await import('../../../electron/hotkey/index')

        const pending = triggerTranslateEntry(manager)

        expect(focus_or_create).toHaveBeenCalledWith('translate', translate_options)
        expect(send_when_ready).toHaveBeenCalledWith('translate', 'translate:selection-pending')
        expect(read_selected_text).not.toHaveBeenCalled()

        await Promise.resolve()
        expect(read_selected_text).toHaveBeenCalled()
        resolve_selection({ text: '', method: 'clipboard', reason: 'copy-failed' })
        await pending

        expect(send_when_ready).toHaveBeenCalledWith('translate', 'translate:input-translate')
    })

    it('sends selection-pending before from-selection when text is found', async () => {
        let resolve_selection: (value: { text: string; method: 'clipboard' }) => void = () => {}
        read_selected_text.mockReturnValueOnce(new Promise((resolve) => { resolve_selection = resolve }))
        const manager = {
            focusOrCreate: focus_or_create,
            sendWhenReady: send_when_ready,
        } as unknown as WindowManager
        const { triggerTranslateEntry } = await import('../../../electron/hotkey/index')

        const pending = triggerTranslateEntry(manager)

        expect(send_when_ready).toHaveBeenCalledWith('translate', 'translate:selection-pending')
        expect(send_when_ready).toHaveBeenCalledTimes(1)
        expect(read_selected_text).not.toHaveBeenCalled()

        await Promise.resolve()
        expect(read_selected_text).toHaveBeenCalled()
        resolve_selection({ text: 'hello', method: 'clipboard' })
        await pending

        expect(send_when_ready).toHaveBeenCalledWith('translate', 'translate:from-selection', 'hello')
        expect(send_when_ready).toHaveBeenCalledTimes(2)
    })
})

describe('selection dictionary hotkey entry', () => {
    it('opens dictionary window before selected text lookup finishes', async () => {
        let resolve_selection: (value: { text: string; method: 'clipboard' }) => void = () => {}
        read_selected_text.mockReturnValueOnce(new Promise((resolve) => { resolve_selection = resolve }))
        const manager = {
            focusOrCreate: focus_or_create,
            sendWhenReady: send_when_ready,
        } as unknown as WindowManager
        const { triggerSelectionDictionary } = await import('../../../electron/hotkey/index')

        const pending = triggerSelectionDictionary(manager)

        expect(focus_or_create).toHaveBeenCalledWith('dict', dict_options)
        expect(send_when_ready).not.toHaveBeenCalled()
        expect(read_selected_text).not.toHaveBeenCalled()

        await Promise.resolve()
        expect(read_selected_text).toHaveBeenCalled()
        resolve_selection({ text: 'hello', method: 'clipboard' })
        await pending

        expect(send_when_ready).toHaveBeenCalledWith('dict', 'dict:lookup', 'hello')
    })

    it('sends empty selection after dictionary window opens', async () => {
        let resolve_selection: (value: { text: string; method: 'clipboard'; reason: 'empty' }) => void = () => {}
        read_selected_text.mockReturnValueOnce(new Promise((resolve) => { resolve_selection = resolve }))
        const manager = {
            focusOrCreate: focus_or_create,
            sendWhenReady: send_when_ready,
        } as unknown as WindowManager
        const { triggerSelectionDictionary } = await import('../../../electron/hotkey/index')

        const pending = triggerSelectionDictionary(manager)

        expect(focus_or_create).toHaveBeenCalledWith('dict', dict_options)
        expect(send_when_ready).not.toHaveBeenCalled()
        expect(read_selected_text).not.toHaveBeenCalled()

        await Promise.resolve()
        expect(read_selected_text).toHaveBeenCalled()
        resolve_selection({ text: '', method: 'clipboard', reason: 'empty' })
        await pending

        expect(send_when_ready).toHaveBeenCalledWith('dict', 'dict:selection-empty')
    })
})
