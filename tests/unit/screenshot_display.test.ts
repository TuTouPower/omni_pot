import type { Display } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const display_b = vi.hoisted(() => ({
    id: 2,
    bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
    size: { width: 2560, height: 1440 },
    scaleFactor: 1.25,
}))
const get_cursor_screen_point = vi.hoisted(() => vi.fn(() => ({ x: 2000, y: 100 })))
const get_display_nearest_point = vi.hoisted(() => vi.fn(() => display_b))
const get_sources = vi.hoisted(() => vi.fn(() => Promise.resolve([
    { display_id: '1', thumbnail: { toPNG: () => Buffer.from('primary') } },
    { display_id: '2', thumbnail: { toPNG: () => Buffer.from('secondary') } },
])))

vi.mock('electron', () => ({
    desktopCapturer: { getSources: get_sources },
    screen: {
        getCursorScreenPoint: get_cursor_screen_point,
        getDisplayNearestPoint: get_display_nearest_point,
    },
}))

vi.mock('../../electron/log', () => ({
    log: { info: vi.fn(), scope: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}))

import { capture_screenshot, get_screenshot_display } from '../../electron/screenshot'

describe('screenshot display selection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('selects the display under the cursor', () => {
        expect(get_screenshot_display()).toBe(display_b)
        expect(get_display_nearest_point).toHaveBeenCalledWith({ x: 2000, y: 100 })
    })

    it('captures the selected display source at display scale', async () => {
        const base64 = await capture_screenshot(display_b as Display)

        expect(get_sources).toHaveBeenCalledWith({
            types: ['screen'],
            thumbnailSize: { width: 3200, height: 1800 },
        })
        expect(Buffer.from(base64, 'base64').toString()).toBe('secondary')
    })

    it('falls back to the first source when display id is missing', async () => {
        const base64 = await capture_screenshot({ ...display_b, id: 3 } as Display)

        expect(Buffer.from(base64, 'base64').toString()).toBe('primary')
    })
})
