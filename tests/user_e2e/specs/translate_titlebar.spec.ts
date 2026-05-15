import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

test.describe('@ui translate titlebar', () => {
    test('titlebar renders the designed layout and drag regions', async ({ omni }) => {
        const translate = await omni.translate()

        await expect(translate.wordmark()).toContainText('omni_pot')
        await expect(translate.modeLabel()).toContainText('翻译')
        expect(await translate.titlebarOrder()).toEqual(['pin', 'wordmark', 'mode', 'close'])
        await expect.poll(async () => await translate.modeLabelHasPillBackground()).toBe(true)
        await expect.poll(async () => await translate.titlebarAppRegion()).toBe('drag')
        await expect.poll(async () => await translate.pinButtonAppRegion()).toBe('no-drag')
        await expect.poll(async () => await translate.closeButtonAppRegion()).toBe('no-drag')
    })

    test('user can pin and close the translate window', async ({ omni }) => {
        const page = await omni.firstWindow()
        const translate = await omni.translate()

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
