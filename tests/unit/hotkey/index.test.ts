import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WindowManager } from '../../../src/main/windows/manager'

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

vi.mock('../../../src/main/selection', () => ({
    readSelectedText: read_selected_text,
}))

vi.mock('../../../src/main/windows/translate_options', () => ({
    get_translate_window_options: () => translate_options,
}))

vi.mock('../../../src/main/windows/dict_options', () => ({
    get_dict_window_options: () => dict_options,
}))

beforeEach(() => {
    vi.clearAllMocks()
})

describe('translate hotkey entry', () => {
    it('opens window and sends selection-pending immediately, before text lookup resolves', async () => {
        let resolve_selection: (value: { text: string; method: 'clipboard'; reason: 'copy-failed' }) => void = () => {}
        read_selected_text.mockReturnValueOnce(new Promise((resolve) => { resolve_selection = resolve }))
        const manager = {
            focusOrCreate: focus_or_create,
            sendWhenReady: send_when_ready,
        } as unknown as WindowManager
        const { triggerTranslateEntry } = await import('../../../src/main/hotkey/index')

        const pending = triggerTranslateEntry(manager)

        // Window must be shown synchronously so the user sees it instantly.
        expect(focus_or_create).toHaveBeenCalledWith('translate', translate_options)
        expect(send_when_ready).toHaveBeenCalledWith('translate', 'translate:selection-pending')

        await Promise.resolve()
        expect(read_selected_text).toHaveBeenCalled()
        resolve_selection({ text: '', method: 'clipboard', reason: 'copy-failed' })
        await pending

        expect(send_when_ready).toHaveBeenCalledWith('translate', 'translate:input-translate')
    })

    it('sends from-selection with text after lookup resolves', async () => {
        let resolve_selection: (value: { text: string; method: 'clipboard' }) => void = () => {}
        read_selected_text.mockReturnValueOnce(new Promise((resolve) => { resolve_selection = resolve }))
        const manager = {
            focusOrCreate: focus_or_create,
            sendWhenReady: send_when_ready,
        } as unknown as WindowManager
        const { triggerTranslateEntry } = await import('../../../src/main/hotkey/index')

        const pending = triggerTranslateEntry(manager)

        expect(focus_or_create).toHaveBeenCalledWith('translate', translate_options)
        expect(send_when_ready).toHaveBeenCalledWith('translate', 'translate:selection-pending')

        await Promise.resolve()
        expect(read_selected_text).toHaveBeenCalled()
        resolve_selection({ text: 'hello', method: 'clipboard' })
        await pending

        expect(send_when_ready).toHaveBeenCalledWith('translate', 'translate:from-selection', 'hello')
        expect(send_when_ready).toHaveBeenCalledTimes(2)
    })
})

describe('selection dictionary hotkey entry', () => {
    it('opens dictionary window immediately, sends lookup after text lookup', async () => {
        let resolve_selection: (value: { text: string; method: 'clipboard' }) => void = () => {}
        read_selected_text.mockReturnValueOnce(new Promise((resolve) => { resolve_selection = resolve }))
        const manager = {
            focusOrCreate: focus_or_create,
            sendWhenReady: send_when_ready,
        } as unknown as WindowManager
        const { triggerSelectionDictionary } = await import('../../../src/main/hotkey/index')

        const pending = triggerSelectionDictionary(manager)

        expect(focus_or_create).toHaveBeenCalledWith('dict', dict_options)

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
        const { triggerSelectionDictionary } = await import('../../../src/main/hotkey/index')

        const pending = triggerSelectionDictionary(manager)

        expect(focus_or_create).toHaveBeenCalledWith('dict', dict_options)

        await Promise.resolve()
        expect(read_selected_text).toHaveBeenCalled()
        resolve_selection({ text: '', method: 'clipboard', reason: 'empty' })
        await pending

        expect(send_when_ready).toHaveBeenCalledWith('dict', 'dict:selection-empty')
    })
})
