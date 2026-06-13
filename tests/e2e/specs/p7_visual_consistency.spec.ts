// Covers TASKS.md P7:
//   - Pin (topmost) and Lock (pin) buttons are consistently present across
//     translate/dict/recognize windows.
//   - Topmost button's pin-icon stick stroke is visible (path M12 16v6).

import { test, expect } from '../fixtures/test'

test.describe('@ui P7 pin/topmost consistency', () => {
    test('translate window exposes both topmost and pin buttons; topmost icon has visible stick', async ({ omni }) => {
        const translate = await omni.translate()
        await expect(translate.topmostButton()).toBeVisible()
        await expect(translate.pinButton()).toBeVisible()
        // Topmost uses Icons.Pin whose stick is the path "M12 16v6".
        const topmost_svg = await translate.topmostButton().locator('svg').innerHTML()
        expect(topmost_svg).toContain('M12 16v6')
    })

    test('dict window exposes both topmost and pin buttons; topmost icon has visible stick', async ({ omni }) => {
        await omni.api.triggerDict('hello')
        const dict = await omni.dict()
        await expect(dict.topmostButton()).toBeVisible()
        await expect(dict.pinButton()).toBeVisible()
        const topmost_svg = await dict.topmostButton().locator('svg').innerHTML()
        expect(topmost_svg).toContain('M12 16v6')
    })

    test('recognize window exposes both topmost and pin buttons; topmost icon has visible stick', async ({ omni }) => {
        const recognize = await omni.openRecognize()
        await expect(recognize.topmostButton()).toBeVisible()
        await expect(recognize.pinButton()).toBeVisible()
        const topmost_svg = await recognize.topmostButton().locator('svg').innerHTML()
        expect(topmost_svg).toContain('M12 16v6')
    })
})
