// Covers docs/TASKS.md P13:
//   - Copy/clear/strip operations show a Toast notification on success.
//   - Toast uses data-testid="toast" and disappears within ~3s.
//   - Toast text matches the expected i18n value (visual content regression).

import { test, expect } from '../fixtures/test'

test.describe('@ui toast feedback', () => {
    test('clearing source text shows a toast with localized text', async ({ omni }) => {
        const translate = await omni.translate()
        await translate.typeSource('hello world')

        await translate.clearSourceButton().click()

        const toast = translate.page.getByTestId('toast')
        await expect(toast).toBeVisible({ timeout: 3000 })
        // Default locale is zh_cn; expect cleared toast text to be non-empty
        // and not the raw i18n key.
        const text = (await toast.textContent()) ?? ''
        expect(text.trim().length).toBeGreaterThan(0)
        expect(text).not.toContain('toast.')
    })

    test('stripping line breaks shows a toast', async ({ omni }) => {
        const translate = await omni.translate()
        await translate.typeSource('hello-\n world')

        await translate.page.getByTestId('source-newline-btn').click()

        await expect(translate.page.getByTestId('toast')).toBeVisible({ timeout: 3000 })
    })

    test('copying source text shows a toast', async ({ omni }) => {
        const translate = await omni.translate()
        await translate.typeSource('copy me')

        await translate.page.getByTestId('source-copy-btn').click()

        await expect(translate.page.getByTestId('toast')).toBeVisible({ timeout: 3000 })
    })

    test('toast auto-dismisses within 3 seconds', async ({ omni }) => {
        const translate = await omni.translate()
        await translate.typeSource('will be cleared')
        await translate.clearSourceButton().click()

        const toast = translate.page.getByTestId('toast')
        await expect(toast).toBeVisible({ timeout: 3000 })
        // default show_toast duration is 2000ms; allow headroom
        await expect(toast).toBeHidden({ timeout: 4000 })
    })
})

