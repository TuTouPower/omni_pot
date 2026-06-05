import type { BrowserWindow } from 'electron'

export function compute_locked_height(
    content_height: number,
    work_area_height: number,
    min_height: number,
    max_height_ratio: number,
): number {
    const max_height = Math.floor(work_area_height * max_height_ratio)
    const rounded = Math.round(content_height)
    if (rounded > max_height) return Math.max(min_height, max_height)
    if (rounded < min_height) return min_height
    return rounded
}

export function apply_locked_window_size(
    win: BrowserWindow,
    min_width: number,
    max_width: number,
    target_height: number,
): void {
    if (win.isDestroyed()) return
    win.setMinimumSize(min_width, target_height)
    win.setMaximumSize(max_width, target_height)
    const bounds = win.getBounds()
    const width = Math.max(bounds.width, min_width)
    if (bounds.height !== target_height || bounds.width !== width) {
        win.setBounds({ ...bounds, width, height: target_height })
    }
}
