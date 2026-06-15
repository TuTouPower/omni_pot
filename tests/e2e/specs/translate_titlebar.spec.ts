import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

async function titlebar_left_clip(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
    const topmost = page.getByTestId('titlebar-topmost')
    const pin = page.getByTestId('titlebar-pin')
    const [topmost_box, pin_box] = await Promise.all([topmost.boundingBox(), pin.boundingBox()])
    if (!topmost_box || !pin_box) throw new Error('titlebar left controls not visible')

    const padding = 6
    const left = Math.floor(Math.min(topmost_box.x, pin_box.x) - padding)
    const top = Math.floor(Math.min(topmost_box.y, pin_box.y) - padding)
    const right = Math.ceil(Math.max(topmost_box.x + topmost_box.width, pin_box.x + pin_box.width) + padding)
    const bottom = Math.ceil(Math.max(topmost_box.y + topmost_box.height, pin_box.y + pin_box.height) + padding)

    return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    }
}

async function expect_titlebar_left_snapshot(snapshot_name: string, action?: (omni: AppFixture) => Promise<void>): Promise<void> {
    const omni = await AppFixture.start({ config: { welcome_dismissed: true } })
    try {
        const translate = await omni.translate()
        await expect(translate.topmostButton()).toBeVisible()
        await expect(translate.pinButton()).toBeVisible()
        if (action) await action(omni)
        const clip = await titlebar_left_clip(translate.page)
        const image = await translate.page.screenshot({ clip, scale: 'css' })
        expect(image).toMatchSnapshot(snapshot_name)
    } finally {
        await omni.stop()
    }
}

test.describe('@ui translate titlebar', () => {
    test('titlebar renders the designed layout and drag regions', async ({ omni }) => {
        const translate = await omni.translate()

        await expect(translate.wordmark()).toContainText('Omni Pot')
        await expect(translate.modeLabel()).toHaveText('Translate')
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

        expect(Math.abs(clear_width - translate_width)).toBeLessThanOrEqual(2)
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

    test('left titlebar controls keep expected icons across independent states', async () => {
        await expect_titlebar_left_snapshot('translate-titlebar-left-default.png')
        await expect_titlebar_left_snapshot('translate-titlebar-left-topmost.png', async (omni) => {
            const translate = await omni.translate()
            await translate.clickTopmost()
            await expect.poll(async () => (await omni.api.windowState('translate')).alwaysOnTop).toBe(true)
            await expect(translate.pinButton()).toHaveAttribute('aria-pressed', 'true')
        })
        await expect_titlebar_left_snapshot('translate-titlebar-left-pin.png', async (omni) => {
            const translate = await omni.translate()
            await translate.clickPin()
            await expect.poll(async () => (await omni.api.getConfig()).translate_pinned).toBe(true)
            await expect.poll(async () => (await omni.api.windowState('translate')).alwaysOnTop).toBe(false)
        })
    })

    test('pinned config applies when the translate window is created', async () => {
        const omni = await AppFixture.start({ config: { translate_always_on_top: true, welcome_dismissed: true } })
        try {
            await omni.firstWindow()
            await expect.poll(async () => (await omni.api.windowState('translate')).alwaysOnTop).toBe(true)
        } finally {
            await omni.stop()
        }
    })

})
