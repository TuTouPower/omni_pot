import { screen, type BrowserWindow, type Display } from 'electron'

export const TRANSLATE_MIN_WIDTH = 360
export const TRANSLATE_MAX_HEIGHT_RATIO = 0.75
export const TRANSLATE_HEIGHT_REPORT_DEBOUNCE_PX = 1
export const TRANSLATE_SCREEN_MOVE_DEBOUNCE_MS = 100
export const TRANSLATE_MAX_W_SENTINEL = 100000

export function compute_target_height(
    content_height: number,
    work_area_height: number,
    min_height: number,
): number {
    const max_height = Math.floor(work_area_height * TRANSLATE_MAX_HEIGHT_RATIO)
    const rounded = Math.round(content_height)
    if (rounded > max_height) return Math.max(min_height, max_height)
    if (rounded < min_height) return min_height
    return rounded
}

interface ControllerOptions {
    initial_min_height: number
}

export class TranslateHeightController {
    private win: BrowserWindow
    private min_height: number
    private current_target_h: number
    private move_timer: ReturnType<typeof setTimeout> | null = null
    private last_reported_h = 0
    private disposed = false

    constructor(win: BrowserWindow, opts: ControllerOptions) {
        this.win = win
        this.min_height = opts.initial_min_height
        this.current_target_h = opts.initial_min_height
        this.apply_locked_height(this.current_target_h)

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
        this.apply_locked_height(target_h)
    }

    private apply_locked_height(h: number): void {
        if (this.win.isDestroyed()) return
        this.win.setMinimumSize(TRANSLATE_MIN_WIDTH, h)
        this.win.setMaximumSize(TRANSLATE_MAX_W_SENTINEL, h)
        const bounds = this.win.getBounds()
        if (bounds.height !== h) {
            this.win.setBounds({ ...bounds, height: h })
        }
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
            this.apply_locked_height(target_h)
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
        this.apply_locked_height(this.current_target_h)
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
