// Covers docs/issues.md "系统托盘菜单UI缺失与显示不全":
//   - Items present: 输入翻译 / OCR 识别 / 截图翻译 / 剪贴板监听 / 设置 /
//     检查更新 / 查看日志 / 重启 / 退出
//   - Group separators between input-actions / clipboard / settings / restart
//   - No tall blank gap inside item area
//   - Popover height is large enough to render every item (no bottom clip)
//
// The current updater_and_tray.spec.ts only asserts that trayAction returns
// success===true. This spec drives the visual layout requirements.

import { test, expect } from '../fixtures/test'

const REQUIRED_ACTIONS = [
    'tray-action-input_translate',
    'tray-action-ocr_recognize',
    'tray-action-screenshot_translate',
    'tray-action-clipboard_monitor',
    'tray-action-config',
    'tray-action-check_update',
    'tray-action-view_log',
    'tray-action-restart',
    'tray-action-quit',
] as const

test.describe('@ui tray popover layout', () => {
    test('popover renders the complete item list with separators and no clipping', async ({ omni }) => {
        const open = await omni.api.trayAction('show_tray')
        expect(open.success).toBe(true)

        const tray_page = await omni.waitForWindow(/#tray/)
        const popover = tray_page.getByTestId('tray-popover')
        await expect(popover).toBeVisible()

        // All required items exist and are visible (no clipping by overflow).
        for (const testid of REQUIRED_ACTIONS) {
            const item = tray_page.getByTestId(testid)
            await expect(item, `missing tray item: ${testid}`).toBeVisible()
        }

        // At least one visual separator between groups (matches demo design).
        const separator_count = await tray_page.locator('[data-testid="tray-separator"]').count()
        expect(separator_count, '托盘菜单需有分组分隔线').toBeGreaterThanOrEqual(2)

        // Bottom item (退出) must be fully within the popover (no clipping).
        const popover_box = await popover.boundingBox()
        const quit_box = await tray_page.getByTestId('tray-action-quit').boundingBox()
        expect(popover_box).not.toBeNull()
        expect(quit_box).not.toBeNull()
        expect(quit_box!.y + quit_box!.height)
            .toBeLessThanOrEqual(popover_box!.y + popover_box!.height + 1)

        // No tall blank gap inside the items area. We measure the vertical gap
        // between adjacent items and assert it is below a "blank block" threshold.
        const item_locators = REQUIRED_ACTIONS.map((id) => tray_page.getByTestId(id))
        const item_boxes = await Promise.all(item_locators.map(async (l) => l.boundingBox()))
        for (let i = 0; i < item_boxes.length - 1; i += 1) {
            const top = item_boxes[i]
            const bottom = item_boxes[i + 1]
            if (!top || !bottom) continue
            const gap = bottom.y - (top.y + top.height)
            expect(gap, `tray item gap between ${REQUIRED_ACTIONS[i]} and ${REQUIRED_ACTIONS[i + 1]} is too large`)
                .toBeLessThanOrEqual(20)
        }
    })
})
