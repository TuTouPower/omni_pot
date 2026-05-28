import { describe, expect, it, vi } from 'vitest'
import type { WindowManager } from '../../../electron/windows/manager'

const read_selected_text = vi.fn()
const focus_or_create = vi.fn()
const send_when_ready = vi.fn()
const translate_options = { label: 'translate', width: 390, height: 160 }

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
    get_dict_window_options: () => ({ label: 'dict', width: 350, height: 420 }),
}))

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
        expect(send_when_ready).not.toHaveBeenCalled()

        resolve_selection({ text: '', method: 'clipboard', reason: 'copy-failed' })
        await pending

        expect(send_when_ready).toHaveBeenCalledWith('translate', 'translate:input-translate')
    })
})
