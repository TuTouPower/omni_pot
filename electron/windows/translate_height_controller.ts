import { screen, type BrowserWindow, type Display } from 'electron'
import { log } from '../log'
import { apply_locked_window_size, compute_locked_height } from './height_controller_common'

const dbg = log.scope('debug-hlc')

export const TRANSLATE_MIN_WIDTH_FALLBACK = 280
export const TRANSLATE_MAX_HEIGHT_RATIO = 0.75
export const TRANSLATE_HEIGHT_REPORT_DEBOUNCE_PX = 1
export const TRANSLATE_WIDTH_REPORT_DEBOUNCE_PX = 1
export const TRANSLATE_SCREEN_MOVE_DEBOUNCE_MS = 100
export const TRANSLATE_MAX_W_SENTINEL = 100000

export function compute_target_height(
    content_height: number,
    work_area_height: number,
    min_height: number,
): number {
    return compute_locked_height(content_height, work_area_height, min_height, TRANSLATE_MAX_HEIGHT_RATIO)
}

export function compute_target_min_width(content_width: number): number {
    return Math.max(TRANSLATE_MIN_WIDTH_FALLBACK, Math.ceil(content_width))
}

interface ControllerOptions {
    initial_min_height: number
}

export class TranslateHeightController {
    private win: BrowserWindow
    private min_height: number
    private current_min_width = TRANSLATE_MIN_WIDTH_FALLBACK
    private current_target_h: number
    private move_timer: ReturnType<typeof setTimeout> | null = null
    private last_reported_h = 0
    private last_reported_w = 0
    private disposed = false

    constructor(win: BrowserWindow, opts: ControllerOptions) {
        this.win = win
        this.min_height = opts.initial_min_height
        this.current_target_h = opts.initial_min_height
        this.apply_locked_size()

        win.on('move', this.on_move)
        win.on('restore', this.on_restore)
        screen.on('display-metrics-changed', this.on_display_metrics)
        win.once('closed', this.dispose)
    }

    report_content_height(content_height: number): void {
        if (this.disposed || this.win.isDestroyed() || !Number.isFinite(content_height) || content_height < 0) return
        const rounded = Math.round(content_height)
        if (Math.abs(rounded - this.last_reported_h) < TRANSLATE_HEIGHT_REPORT_DEBOUNCE_PX) return
        this.last_reported_h = rounded
        const work_area_h = this.current_display().workArea.height
        const target_h = compute_target_height(rounded, work_area_h, this.min_height)
        if (target_h === this.current_target_h) return
        this.current_target_h = target_h
        this.apply_locked_size()
    }

    report_min_width(content_width: number): void {
        if (this.disposed || this.win.isDestroyed() || !Number.isFinite(content_width) || content_width < 0) return
        const rounded = Math.ceil(content_width)
        dbg.debug('report_min_width: raw=%.2f, rounded=%d, last=%d', content_width, rounded, this.last_reported_w)
        if (Math.abs(rounded - this.last_reported_w) < TRANSLATE_WIDTH_REPORT_DEBOUNCE_PX) return
        this.last_reported_w = rounded
        const min_width = compute_target_min_width(rounded)
        if (min_width === this.current_min_width) return
        this.current_min_width = min_width
        this.apply_locked_size()
    }

    private apply_locked_size(): void {
        if (this.win.isDestroyed()) return
        const bounds = this.win.getBounds()
        const width = Math.max(bounds.width, this.current_min_width)
        dbg.debug('apply_locked_size: bounds.w=%d, min_w=%d, target_h=%d, setW=%d, setH=%d, changed=%s',
            bounds.width, this.current_min_width, this.current_target_h, width, this.current_target_h, bounds.height !== this.current_target_h || bounds.width !== width)
        apply_locked_window_size(this.win, this.current_min_width, TRANSLATE_MAX_W_SENTINEL, this.current_target_h)
    }

    private current_display(): Display {
        return screen.getDisplayMatching(this.win.getBounds())
    }

    private recompute_for_new_workarea(): void {
        if (this.last_reported_h <= 0) return
        const work_area_h = this.current_display().workArea.height
        const target_h = compute_target_height(this.last_reported_h, work_area_h, this.min_height)
        if (target_h !== this.current_target_h) {
            this.current_target_h = target_h
            this.apply_locked_size()
        }
    }

    private on_move = (): void => {
        if (this.move_timer) clearTimeout(this.move_timer)
        this.move_timer = setTimeout(() => {
            this.move_timer = null
            this.recompute_for_new_workarea()
        }, TRANSLATE_SCREEN_MOVE_DEBOUNCE_MS)
    }

    private on_restore = (): void => {
        this.apply_locked_size()
    }

    private on_display_metrics = (): void => {
        this.recompute_for_new_workarea()
    }

    dispose = (): void => {
        if (this.disposed) return
        this.disposed = true
        if (this.move_timer) clearTimeout(this.move_timer)
        this.move_timer = null
        if (!this.win.isDestroyed()) {
            this.win.removeListener('move', this.on_move)
            this.win.removeListener('restore', this.on_restore)
        }
        screen.removeListener('display-metrics-changed', this.on_display_metrics)
    }
}
