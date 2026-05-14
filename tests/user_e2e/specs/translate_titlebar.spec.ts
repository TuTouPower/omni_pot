import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

test.describe('@ui translate titlebar', () => {
    test('user can pin and close the translate window', async ({ omni }) => {
        const page = await omni.firstWindow()
        const translate = await omni.translate()

        await expect(translate.wordmark()).toContainText('omni_pot')
        await expect(translate.modeLabel()).toContainText('翻译')

        await expect.poll(async () => (await omni.api.windowState('translate')).visible).toBe(true)
        await expect.poll(async () => (await omni.api.windowState('translate')).alwaysOnTop).toBe(false)

        await translate.clickPin()
        await expect.poll(async () => (await omni.api.windowState('translate')).alwaysOnTop).toBe(true)
        await expect(translate.pinButton()).toHaveAttribute('aria-pressed', 'true')

        await translate.clickPin()
        await expect.poll(async () => (await omni.api.windowState('translate')).alwaysOnTop).toBe(false)

        const closed = page.waitForEvent('close')
        await translate.clickClose()
        await closed
    })

    test('pinned config applies when the translate window is created', async () => {
        const omni = await AppFixture.start({ config: { translate_always_on_top: true } })
        try {
            await omni.firstWindow()
            await expect.poll(async () => (await omni.api.windowState('translate')).alwaysOnTop).toBe(true)
        } finally {
            await omni.stop()
        }
    })
})
