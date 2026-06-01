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

vi.mock('../../../electron/log', () => ({
    log: {
        scope: vi.fn(() => ({
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        })),
    },
}))

import { screen } from 'electron'
import {
    compute_target_height,
    compute_target_min_width,
    TranslateHeightController,
    TRANSLATE_MAX_HEIGHT_RATIO,
} from '../../../electron/windows/translate_height_controller'

describe('compute_target_height', () => {
    it('returns content height when within bounds', () => {
        expect(compute_target_height(500, 1080, 100)).toBe(500)
    })

    it('clamps to min when content height is below min', () => {
        expect(compute_target_height(50, 1080, 100)).toBe(100)
    })

    it('clamps to max when content exceeds it', () => {
        expect(compute_target_height(2000, 1080, 100)).toBe(810)
    })

    it('floors the max so it never exceeds integer pixels', () => {
        expect(compute_target_height(2000, 1079, 100)).toBe(809)
    })

    it('returns min when both content and max are below min', () => {
        expect(compute_target_height(50, 100, 100)).toBe(100)
    })

    it('rounds content height to integer', () => {
        expect(compute_target_height(500.7, 1080, 100)).toBe(501)
    })
})

describe('compute_target_min_width', () => {
    it('uses 280 as the hard fallback minimum', () => {
        expect(compute_target_min_width(100)).toBe(280)
    })

    it('uses measured language row width when it is wider than fallback', () => {
        expect(compute_target_min_width(341.2)).toBe(342)
    })
})

function make_fake_win(): {
    win: any
    set_min: ReturnType<typeof vi.fn>
    set_max: ReturnType<typeof vi.fn>
    set_bounds: ReturnType<typeof vi.fn>
    listeners: Map<string, (...args: any[]) => void>
} {
    const set_min = vi.fn()
    const set_max = vi.fn()
    const set_bounds = vi.fn()
    const listeners = new Map<string, (...args: any[]) => void>()
    let bounds = { x: 0, y: 0, width: 430, height: 160 }
    const win = {
        isDestroyed: vi.fn(() => false),
        setMinimumSize: set_min,
        setMaximumSize: set_max,
        setBounds: vi.fn((b: typeof bounds) => { bounds = { ...bounds, ...b }; set_bounds(b) }),
        getBounds: () => ({ ...bounds }),
        on: vi.fn((event: string, handler: (...args: any[]) => void) => { listeners.set(event, handler) }),
        once: vi.fn((event: string, handler: (...args: any[]) => void) => { listeners.set(event, handler) }),
        removeListener: vi.fn(),
    }
    return { win, set_min, set_max, set_bounds, listeners }
}

describe('TranslateHeightController', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        ;(screen.on as any).mockClear()
        ;(screen.getDisplayMatching as any).mockReturnValue({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })
    })

    afterEach(() => { vi.useRealTimers() })

    it('applies locked size on construction using initial_min_height', () => {
        const { win, set_min, set_max } = make_fake_win()
        new TranslateHeightController(win as any, { initial_min_height: 160 })
        expect(set_min).toHaveBeenCalledWith(280, 160)
        expect(set_max).toHaveBeenCalledWith(100000, 160)
    })

    it('report_content_height grows window to reported height', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new TranslateHeightController(win as any, { initial_min_height: 160 })
        set_bounds.mockClear()
        c.report_content_height(500)
        expect(set_bounds).toHaveBeenCalledWith(expect.objectContaining({ height: 500 }))
    })

    it('clamps reported height to work_area * 0.75', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new TranslateHeightController(win as any, { initial_min_height: 160 })
        set_bounds.mockClear()
        c.report_content_height(5000)
        const max = Math.floor(1080 * TRANSLATE_MAX_HEIGHT_RATIO)
        expect(set_bounds).toHaveBeenCalledWith(expect.objectContaining({ height: max }))
    })

    it('debounces 1px changes in content height (no re-apply)', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new TranslateHeightController(win as any, { initial_min_height: 160 })
        c.report_content_height(500)
        set_bounds.mockClear()
        c.report_content_height(500.4)
        expect(set_bounds).not.toHaveBeenCalled()
    })

    it('applies height when change exceeds debounce threshold', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new TranslateHeightController(win as any, { initial_min_height: 160 })
        c.report_content_height(500)
        set_bounds.mockClear()
        c.report_content_height(502)
        expect(set_bounds).toHaveBeenCalledWith(expect.objectContaining({ height: 502 }))
    })

    it('report_min_width updates minimum width', () => {
        const { win, set_min } = make_fake_win()
        const c = new TranslateHeightController(win as any, { initial_min_height: 160 })
        set_min.mockClear()
        c.report_min_width(350)
        expect(set_min).toHaveBeenCalledWith(350, expect.any(Number))
    })

    it('debounces 1px changes in min width (no re-apply)', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new TranslateHeightController(win as any, { initial_min_height: 160 })
        c.report_min_width(350)
        set_bounds.mockClear()
        c.report_min_width(350.4)
        expect(set_bounds).not.toHaveBeenCalled()
    })

    it('dispose stops further updates and is idempotent', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new TranslateHeightController(win as any, { initial_min_height: 160 })
        c.dispose()
        c.dispose()
        set_bounds.mockClear()
        c.report_content_height(600)
        expect(set_bounds).not.toHaveBeenCalled()
    })

    it('ignores invalid inputs (NaN / negative)', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new TranslateHeightController(win as any, { initial_min_height: 160 })
        set_bounds.mockClear()
        c.report_content_height(Number.NaN)
        c.report_content_height(-100)
        expect(set_bounds).not.toHaveBeenCalled()
    })

    it('recomputes after display-metrics-changed when workArea shrinks', () => {
        const { win, set_bounds } = make_fake_win()
        const c = new TranslateHeightController(win as any, { initial_min_height: 160 })
        c.report_content_height(800)
        set_bounds.mockClear()
        ;(screen.getDisplayMatching as any).mockReturnValue({ workArea: { x: 0, y: 0, width: 1920, height: 600 } })
        const calls = (screen.on as any).mock.calls as Array<[string, () => void]>
        const handler = calls.find(([ev]) => ev === 'display-metrics-changed')?.[1]
        handler?.()
        const max = Math.floor(600 * TRANSLATE_MAX_HEIGHT_RATIO)
        expect(set_bounds).toHaveBeenCalledWith(expect.objectContaining({ height: max }))
    })

    it('on_move debounces and recomputes after move timer elapses', () => {
        const { win, set_bounds, listeners } = make_fake_win()
        const c = new TranslateHeightController(win as any, { initial_min_height: 160 })
        c.report_content_height(800)
        set_bounds.mockClear()
        ;(screen.getDisplayMatching as any).mockReturnValue({ workArea: { x: 0, y: 0, width: 1920, height: 600 } })
        listeners.get('move')?.()
        // Before debounce fires, no update
        expect(set_bounds).not.toHaveBeenCalled()
        vi.advanceTimersByTime(100)
        const max = Math.floor(600 * TRANSLATE_MAX_HEIGHT_RATIO)
        expect(set_bounds).toHaveBeenCalledWith(expect.objectContaining({ height: max }))
    })
})
