// Covers docs/issues.md "输入框固定 8 行 + 单滚动条":
//   - The textarea is always rendered at ~8 lines of visible height regardless of
//     content (default == max == 8 lines).
//   - Long content scrolls inside the textarea, and ONLY the textarea — no
//     duplicate scrollbar on the outer wrapper.
//
// Line-height is 22px (src/windows/translate/source_area.tsx), so 8 lines ≈ 176px.

import { test, expect } from '../fixtures/test'

const LINE_HEIGHT_PX = 22
const TARGET_LINES = 8
const HEIGHT_TOLERANCE_PX = 32

test.describe('@ui translate input row cap', () => {
    test('textarea starts at 1 line and caps at 8 lines, with single inner scrollbar', async ({ omni }) => {
        const translate = await omni.translate()
        const textarea = translate.sourceInput()

        // 1) Single line — textarea must be ~1 line (grows from 1 line).
        await translate.typeSource('one line')
        const one_line_box = await textarea.boundingBox()
        if (!one_line_box) throw new Error('missing one-line textarea box')
        expect(one_line_box.height).toBeGreaterThanOrEqual(LINE_HEIGHT_PX - HEIGHT_TOLERANCE_PX)
        expect(one_line_box.height).toBeLessThanOrEqual(LINE_HEIGHT_PX * 2 + HEIGHT_TOLERANCE_PX)

        // 2) Twenty lines — height is capped at ~8 lines, scroll is internal.
        await translate.typeSource(Array.from({ length: 20 }, (_, i) => `line ${String(i + 1)}`).join('\n'))
        const big_box = await textarea.boundingBox()
        if (!big_box) throw new Error('missing twenty-line textarea box')
        expect(big_box.height).toBeLessThanOrEqual(LINE_HEIGHT_PX * TARGET_LINES + HEIGHT_TOLERANCE_PX)

        // The textarea itself must scroll, not its wrapper.
        const scroll_state = await textarea.evaluate((el) => {
            const t = el as HTMLTextAreaElement
            const style = window.getComputedStyle(t)
            return {
                scroll_h: t.scrollHeight,
                client_h: t.clientHeight,
                overflow_y: style.overflowY,
            }
        })
        expect(scroll_state.scroll_h).toBeGreaterThan(scroll_state.client_h)
        expect(scroll_state.overflow_y).toBe('auto')

        // No direct parent wrapper of the textarea may itself have a
        // visible scrollbar (the textarea should be the only scroller).
        const parent_scroll = await textarea.evaluate((el) => {
            const parent = el.parentElement
            if (!parent) return false
            const o = window.getComputedStyle(parent).overflowY
            return (o === 'auto' || o === 'scroll') && parent.scrollHeight > parent.clientHeight
        })
        expect(parent_scroll, 'direct parent wrapper should not scroll').toBe(false)

        // Action buttons must still be reachable below the (large) textarea.
        await expect(translate.translateButton()).toBeVisible()
        await expect(translate.clearSourceButton()).toBeVisible()
    })
})
