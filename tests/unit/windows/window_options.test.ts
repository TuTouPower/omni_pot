import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const config_values = vi.hoisted(() => new Map<string, unknown>())
const get_config = vi.hoisted(() => vi.fn((key: string) => config_values.get(key)))
const set_config = vi.hoisted(() => vi.fn((key: string, value: unknown) => { config_values.set(key, value) }))

vi.mock('../../../src/main/config/store', () => ({
    getConfig: get_config,
    setConfig: set_config,
}))

import { get_dict_window_options, attach_dict_resize_persistence } from '../../../src/main/windows/dict_options'
import { get_translate_window_options } from '../../../src/main/windows/translate_options'

function reset_config(): void {
    config_values.clear()
    config_values.set('translate_remember_window_size', true)
    config_values.set('dict_remember_window_size', true)
    config_values.set('translate_window_width', 240)
    config_values.set('translate_window_height', 720)
    config_values.set('dict_window_width', 430)
    config_values.set('dict_window_height', 440)
    config_values.set('translate_always_on_top', false)
    config_values.set('dict_always_on_top', false)
}

describe('window options', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        reset_config()
        get_config.mockClear()
        set_config.mockClear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('uses independent saved sizes for translate and dict windows', () => {
        expect(get_translate_window_options()).toMatchObject({ width: 280, height: 160, minWidth: 280 })
        expect(get_dict_window_options()).toMatchObject({ width: 430, height: 440 })
    })

    it('persists dict window resize without changing translate window size', () => {
        let resize_handler: (() => void) | undefined
        const win = {
            listenerCount: vi.fn(() => 0),
            on: vi.fn((_event: string, handler: () => void) => { resize_handler = handler }),
            getSize: vi.fn(() => [520, 530]),
            isDestroyed: vi.fn(() => false),
        } as unknown as BrowserWindow

        attach_dict_resize_persistence(win)
        resize_handler?.()
        vi.advanceTimersByTime(300)

        expect(set_config).toHaveBeenCalledWith('dict_window_width', 520)
        expect(set_config).toHaveBeenCalledWith('dict_window_height', 530)
        expect(set_config).not.toHaveBeenCalledWith('translate_window_width', expect.anything())
        expect(set_config).not.toHaveBeenCalledWith('translate_window_height', expect.anything())
    })
})
