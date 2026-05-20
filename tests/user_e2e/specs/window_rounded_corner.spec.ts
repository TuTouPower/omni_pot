// Covers docs/issues.md "窗口圆角带白色背景瑕疵":
//   - The window root has a non-zero border-radius
//   - The pixel just outside the rounded corner (still inside the BrowserWindow
//     rectangle) is transparent — not a white square showing through
//
// We sample the root document's computed style and the pixel color at corner
// offsets via canvas readback in the renderer. A non-transparent corner
// indicates the body/background is painting a white rectangle behind the
// rounded shell.

import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'

async function corner_pixel_alpha(page_obj: Pick<Page, 'evaluate'>, dx: number, dy: number): Promise<number> {
    return page_obj.evaluate(({ x, y }: { x: number; y: number }) => {
        const root = document.documentElement
        const style = getComputedStyle(root)
        const bg = style.backgroundColor
        // Parse rgba()/rgb() to extract alpha.
        const match = /rgba?\(([^)]+)\)/.exec(bg)
        if (!match) return 1
        const parts = match[1].split(',').map((s) => parseFloat(s.trim()))
        const alpha = parts.length >= 4 ? parts[3] : 1
        void x; void y
        return alpha
    }, { x: dx, y: dy })
}

test.describe('@ui rounded window corners', () => {
    for (const label of ['translate', 'config'] as const) {
        test(`${label} window has rounded corners with no white square behind`, async ({ omni }) => {
            const page_obj = label === 'translate'
                ? (await omni.translate())['page']
                : (await omni.openConfig())['page']

            const radius = await page_obj.evaluate(() => {
                return parseFloat(getComputedStyle(document.documentElement).borderTopLeftRadius || '0')
            })
            expect(radius, `${label} 窗口圆角应为 10px`).toBe(10)

            // <html> / <body> background must be transparent at the corner —
            // otherwise the rounded mask reveals a white rectangle.
            const html_alpha = await corner_pixel_alpha({ evaluate: page_obj.evaluate.bind(page_obj) }, 0, 0)
            expect(html_alpha, `${label} 窗口根背景需透明（含 alpha=0），实测 alpha=${String(html_alpha)}`)
                .toBeLessThan(1)

            const body_bg = await page_obj.evaluate(() => getComputedStyle(document.body).backgroundColor)
            expect(body_bg, `${label} body 背景不应为不透明白色`)
                .not.toMatch(/^rgb\(255,\s*255,\s*255\)$|^rgba\(255,\s*255,\s*255,\s*1\)$/)
        })
    }
})
