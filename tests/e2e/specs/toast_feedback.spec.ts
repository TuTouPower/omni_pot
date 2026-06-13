// Covers docs/TASKS.md P13:
//   - Copy/clear/strip operations show a Toast notification on success.

import { test, expect } from '../fixtures/test'

test.describe('@ui toast feedback', () => {
    test('clearing source text shows a toast', async ({ omni }) => {
        const translate = await omni.translate()
        await translate.typeSource('hello world')

        await translate.clearSourceButton().click()

        await expect(translate.page.getByTestId('toast')).toBeVisible({ timeout: 3000 })
    })
})
