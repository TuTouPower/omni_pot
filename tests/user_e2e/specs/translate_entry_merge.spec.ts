// Covers docs/issues.md "翻译功能合并（输入/选中）":
//   - There is ONE entry point. If the user has a selection, it behaves like
//     selection-translate (fills source from clipboard / selection). Otherwise
//     it behaves like input-translate (opens an empty translate window for the
//     user to type into).
//
// The current E2E API has two distinct endpoints (`triggerSelection`,
// `triggerInputTranslate`). The spec exercises the unified hotkey path
// (`triggerHotkey('translate')`) and asserts the source field reflects the
// correct branch depending on whether a selection was provided.

import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

test.describe('@ui translate entry merge', () => {
    test('welcome page shows a single merged translate entry, not two separate ones', async () => {
        const omni = await AppFixture.start({ config: { welcome_dismissed: false } })
        try {
            const translate = await omni.translate()
            const page = translate.sourceInput().page()
            await expect(page.getByTestId('welcome-translate')).toBeVisible()
            await expect(page.getByTestId('welcome-selection-translate')).toHaveCount(0)
            await expect(page.getByTestId('welcome-input-translate')).toHaveCount(0)
        } finally {
            await omni.stop()
        }
    })

    test('hotkey with a selection performs selection-translate (source filled)', async ({ omni }) => {
        const translate = await omni.translate()
        const result = await omni.api.triggerHotkey('translate', 'merged selection text')
        expect(result.success).toBe(true)

        await expect(translate.sourceInput()).toHaveValue('merged selection text', { timeout: 10_000 })
    })

    test('hotkey without a selection performs input-translate (empty source)', async ({ omni }) => {
        const translate = await omni.translate()
        await translate.typeSource('previous text')
        await translate.clickClearSource()

        const result = await omni.api.triggerHotkey('translate', '')
        expect(result.success).toBe(true)

        // Window is shown, source is empty (input mode), no error.
        await expect(translate.sourceInput()).toBeVisible({ timeout: 10_000 })
        await expect(translate.sourceInput()).toHaveValue('')
        await expect(translate.resultErrors()).toHaveCount(0)
    })
})
