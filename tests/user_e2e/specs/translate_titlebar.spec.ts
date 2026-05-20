import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

test.describe('@ui translate titlebar', () => {
    test('titlebar renders the designed layout and drag regions', async ({ omni }) => {
        const translate = await omni.translate()

        await expect(translate.wordmark()).toContainText('Omni Pot')
        await expect(translate.modeLabel()).toHaveText('翻译')
        expect(await translate.titlebarOrder()).toEqual(['topmost', 'pin', 'wordmark', 'mode', 'close'])
        await expect.poll(async () => await translate.modeLabelHasPillBackground()).toBe(false)
        await expect.poll(async () => await translate.titlebarAppRegion()).toBe('drag')
        await expect.poll(async () => await translate.pinButtonAppRegion()).toBe('no-drag')
        await expect.poll(async () => await translate.topmostButtonAppRegion()).toBe('no-drag')
        await expect.poll(async () => await translate.closeButtonAppRegion()).toBe('no-drag')
    })

    test('ordinary action symbols match text size while window controls are larger', async ({ omni }) => {
        const translate = await omni.translate()

        const clear_width = await translate.icon_width(translate.clearSourceButton())
        const translate_width = await translate.icon_width(translate.translateButton())
        const pin_width = await translate.icon_width(translate.pinButton())
        const close_width = await translate.icon_width(translate.closeButton())

        expect(Math.abs(clear_width - translate_width)).toBeLessThanOrEqual(1)
        expect(pin_width).toBeGreaterThan(clear_width)
        expect(close_width).toBeGreaterThan(translate_width)
    })

    test('user can pin and close the translate window', async ({ omni }) => {
        const page = await omni.firstWindow()
        const translate = await omni.translate()

        await expect.poll(async () => (await omni.api.windowState('translate')).visible).toBe(true)
        await expect.poll(async () => (await omni.api.windowState('translate')).alwaysOnTop).toBe(false)

        await translate.clickPin()
        await expect.poll(async () => (await omni.api.getConfig()).translate_pinned).toBe(true)
        await expect.poll(async () => (await omni.api.windowState('translate')).alwaysOnTop).toBe(false)
        await expect(translate.pinButton()).toHaveAttribute('aria-pressed', 'true')

        await translate.clickPin()
        await expect.poll(async () => (await omni.api.getConfig()).translate_pinned).toBe(false)
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
