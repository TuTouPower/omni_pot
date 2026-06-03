import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => {
    const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } }
    const screen_mock = {
        getDisplayMatching: vi.fn(() => display),
        on: vi.fn(),
        removeListener: vi.fn(),
    }
    return { screen: screen_mock }
})

import { screen } from 'electron'
import {
    compute_dict_target_height,
    DictHeightController,
    DICT_MAX_HEIGHT_RATIO,
} from '../../../electron/windows/dict_height_controller'

describe('compute_dict_target_height', () => {
    it('returns content height within bounds', () => {
        expect(compute_dict_target_height(500, 1080, 120)).toBe(500)
    })

    it('clamps to min when below min', () => {
        expect(compute_dict_target_height(50, 1080, 120)).toBe(120)
    })

    it('clamps to work_area * 0.75 when above max', () => {
        const max = Math.floor(1080 * DICT_MAX_HEIGHT_RATIO)
        expect(compute_dict_target_height(2000, 1080, 120)).toBe(max)
    })

    it('rounds content to integer', () => {
        expect(compute_dict_target_height(500.7, 1080, 120)).toBe(501)
    })

    it('returns min when max is below min', () => {
        expect(compute_dict_target_height(50, 100, 120)).toBe(120)
    })
})

function make_fake_win(): {
    win: any
    set_min: ReturnType<typeof vi.fn>
    set_max: ReturnType<typeof vi.fn>
    set_bounds: ReturnType<typeof vi.fn>
    listeners: Map<string, () => void>
} {
    const set_min = vi.fn()
    const set_max = vi.fn()
    const set_bounds = vi.fn()
    const listeners = new Map<string, () => void>()
    let bounds = { x: 0, y: 0, width: 350, height: 120 }
    const win = {
        isDestroyed: vi.fn(() => false),
        setMinimumSize: set_min,
        setMaximumSize: set_max,
        setBounds: vi.fn((b: typeof bounds) => { bounds = { ...bounds, ...b }; set_bounds(b) }),
        getBounds: () => ({ ...bounds }),
        on: vi.fn((event: string, handler: () => void) => { listeners.set(event, handler) }),
        once: vi.fn((event: string, handler: () => void) => { listeners.set(event, handler) }),
        removeListener: vi.fn(),
    }
    return { win, set_min, set_max, set_bounds, listeners }
}

describe('DictHeightController', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        ;(screen.on as any).mockClear()
        ;(screen.getDisplayMatching as any).mockReturnValue({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })
    })

    afterEach(() => { vi.useRealTimers() })

    it('applies locked size on construction using initial_min_height', () => {
        const { win, set_min, set_max } = make_fake_win()
        new DictHeightController(win as any, { initial_min_height: 120, min_width: 280 })
        expect(set_min).toHaveBeenCalledWith(280, 120)
        expect(set_max).toHaveBeenCalledWith(100000, 120)
    })

    it('report_content_height grows window to reported height', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new DictHeightController(win as any, { initial_min_height: 120, min_width: 280 })
        set_bounds.mockClear()
        c.report_content_height(500)
        expect(set_bounds).toHaveBeenCalledWith(expect.objectContaining({ height: 500 }))
    })

    it('clamps reported height to work_area * 0.75', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new DictHeightController(win as any, { initial_min_height: 120, min_width: 280 })
        set_bounds.mockClear()
        c.report_content_height(5000)
        const max = Math.floor(1080 * DICT_MAX_HEIGHT_RATIO)
        expect(set_bounds).toHaveBeenCalledWith(expect.objectContaining({ height: max }))
    })

    it('debounces 1px changes (no re-apply)', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new DictHeightController(win as any, { initial_min_height: 120, min_width: 280 })
        c.report_content_height(500)
        set_bounds.mockClear()
        c.report_content_height(501)
        expect(set_bounds).not.toHaveBeenCalled()
    })

    it('dispose stops further updates and is idempotent', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new DictHeightController(win as any, { initial_min_height: 120, min_width: 280 })
        c.dispose()
        c.dispose()
        set_bounds.mockClear()
        c.report_content_height(600)
        expect(set_bounds).not.toHaveBeenCalled()
    })

    it('ignores invalid inputs (NaN / negative)', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new DictHeightController(win as any, { initial_min_height: 120, min_width: 280 })
        set_bounds.mockClear()
        c.report_content_height(Number.NaN)
        c.report_content_height(-100)
        expect(set_bounds).not.toHaveBeenCalled()
    })

    it('recomputes after display-metrics-changed when workArea shrinks', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new DictHeightController(win as any, { initial_min_height: 120, min_width: 280 })
        c.report_content_height(800)
        set_bounds.mockClear()
        ;(screen.getDisplayMatching as any).mockReturnValue({ workArea: { x: 0, y: 0, width: 1920, height: 600 } })
        // invoke registered display-metrics-changed handler captured via screen.on
        const calls = (screen.on as any).mock.calls as Array<[string, () => void]>
        const handler = calls.find(([ev]) => ev === 'display-metrics-changed')?.[1]
        handler?.()
        const max = Math.floor(600 * DICT_MAX_HEIGHT_RATIO)
        expect(set_bounds).toHaveBeenCalledWith(expect.objectContaining({ height: max }))
    })
})
