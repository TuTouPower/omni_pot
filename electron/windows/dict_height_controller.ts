import { screen, type BrowserWindow, type Display } from 'electron'
import { apply_locked_window_size, compute_locked_height } from './height_controller_common'

export const DICT_MAX_HEIGHT_RATIO = 0.75
const DICT_HEIGHT_REPORT_DEBOUNCE_PX = 1
const DICT_SCREEN_MOVE_DEBOUNCE_MS = 100
const DICT_MAX_W_SENTINEL = 100000

export function compute_dict_target_height(
    content_height: number,
    work_area_height: number,
    min_height: number,
): number {
    return compute_locked_height(content_height, work_area_height, min_height, DICT_MAX_HEIGHT_RATIO)
}

interface ControllerOptions {
    initial_min_height: number
    min_width: number
}

export class DictHeightController {
    private win: BrowserWindow
    private min_height: number
    private min_width: number
    private current_target_h: number
    private move_timer: ReturnType<typeof setTimeout> | null = null
    private last_reported_h = 0
    private disposed = false

    constructor(win: BrowserWindow, opts: ControllerOptions) {
        this.win = win
        this.min_height = opts.initial_min_height
        this.min_width = opts.min_width
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
        if (Math.abs(rounded - this.last_reported_h) <= DICT_HEIGHT_REPORT_DEBOUNCE_PX) return
        this.last_reported_h = rounded
        const work_area_h = this.current_display().workArea.height
        const target_h = compute_dict_target_height(rounded, work_area_h, this.min_height)
        if (target_h === this.current_target_h) return
        this.current_target_h = target_h
        this.apply_locked_size()
    }

    private apply_locked_size(): void {
        apply_locked_window_size(this.win, this.min_width, DICT_MAX_W_SENTINEL, this.current_target_h)
    }

    private current_display(): Display {
        return screen.getDisplayMatching(this.win.getBounds())
    }

    private recompute_for_new_workarea(): void {
        if (this.last_reported_h <= 0) return
        const work_area_h = this.current_display().workArea.height
        const target_h = compute_dict_target_height(this.last_reported_h, work_area_h, this.min_height)
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
        }, DICT_SCREEN_MOVE_DEBOUNCE_MS)
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
