// Covers docs/issues.md "输入框动态行数限制":
//   - <= 8 rows: source area grows with content (no scroll)
//   - >  8 rows: textarea is capped at 8 rows and scrolls internally
//
// We assert the rendered visible height of the textarea against the line-height
// (22px per line in src/windows/translate/source_area.tsx), not the row attribute,
// to catch silent regressions in CSS / wrapper max-height.

import { test, expect } from '../fixtures/test'

const LINE_HEIGHT_PX = 22
const PADDING_TOLERANCE_PX = 6

test.describe('@ui translate input row cap', () => {
    test('textarea grows with content up to 8 lines, then caps and scrolls', async ({ omni }) => {
        const translate = await omni.translate()
        await translate.ensureSourceVisible()
        const textarea = translate.sourceInput()

        // 1) Single line: textarea height ~= 1 line.
        await translate.typeSource('one line')
        const one_line_box = await textarea.boundingBox()
        if (!one_line_box) throw new Error('missing one-line textarea box')
        expect(one_line_box.height).toBeLessThanOrEqual(LINE_HEIGHT_PX + PADDING_TOLERANCE_PX)

        // 2) Five lines: textarea grows roughly linearly.
        await translate.typeSource(Array.from({ length: 5 }, (_, i) => `line ${String(i + 1)}`).join('\n'))
        const five_line_box = await textarea.boundingBox()
        if (!five_line_box) throw new Error('missing five-line textarea box')
        expect(five_line_box.height).toBeGreaterThanOrEqual(LINE_HEIGHT_PX * 4)
        expect(five_line_box.height).toBeLessThanOrEqual(LINE_HEIGHT_PX * 6)

        // 3) Twenty lines: textarea caps at 8 visible lines and becomes scrollable.
        await translate.typeSource(Array.from({ length: 20 }, (_, i) => `line ${String(i + 1)}`).join('\n'))
        const big_box = await textarea.boundingBox()
        if (!big_box) throw new Error('missing twenty-line textarea box')
        expect(big_box.height).toBeLessThanOrEqual(LINE_HEIGHT_PX * 8 + PADDING_TOLERANCE_PX * 2)

        // Internal scroll must be enabled — scrollHeight should exceed clientHeight.
        const scroll_state = await textarea.evaluate((el) => {
            const t = el as HTMLTextAreaElement
            return { scrollHeight: t.scrollHeight, clientHeight: t.clientHeight }
        })
        expect(scroll_state.scrollHeight).toBeGreaterThan(scroll_state.clientHeight)

        // Action buttons must still be reachable (not pushed off-screen by the
        // oversized textarea).
        await expect(translate.translateButton()).toBeVisible()
        await expect(translate.clearSourceButton()).toBeVisible()
    })
})
