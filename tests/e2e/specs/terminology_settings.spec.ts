// Covers docs/issues.md "术语统一: 配置改为设置":
//   - UI never shows the word "配置" — uses "设置" instead
//   - Tray and config window are consistent
//   - Locale files (zh_cn) do not surface the legacy term in any user-visible
//     label that we render
//
// We don't enforce internal variable names here (that's a code review concern);
// we only enforce user-facing strings inside the rendered DOM.

import { test, expect } from '../fixtures/test'

function expect_no_legacy_term(page_text: string, scope: string): void {
    expect(page_text, `${scope} 含有禁用词「配置」`).not.toContain('配置')
}

test.describe('@ui terminology 配置→设置', () => {
    test('config window never uses the term 配置', async ({ omni }) => {
        const config = await omni.openConfig()
        const page = config['page']
        await expect(page.getByTestId('config-title')).toBeVisible()

        const body_text = await page.locator('body').innerText()
        expect_no_legacy_term(body_text, '设置窗口')

        // Window title (visible in the OS title bar / accessibility tree)
        // should also use 设置.
        const title = await page.title()
        expect(title.includes('配置')).toBe(false)
    })

    test('tray menu uses 设置 not 配置', async ({ omni }) => {
        const tray = await omni.api.trayMenu()
        expect(tray.success).toBe(true)
        for (const label of tray.labels) {
            expect(label, `托盘项「${label}」含禁用词「配置」`).not.toContain('配置')
        }
        expect(tray.labels.some((label) => label === 'Settings' || label === '设置')).toBe(true)
    })

    test('translate window does not surface 配置 in any visible string', async ({ omni }) => {
        const translate = await omni.translate()
        const body_text = await translate['page'].locator('body').innerText()
        expect_no_legacy_term(body_text, '翻译窗口')
    })
})
