import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import type { RecognizePage } from '../pages/recognize_page'

const screenshot_config = {
    recognize_service_list: [],
    service_instances: {},
}

const screenshot_ocr_config = {
    recognize_service_list: ['baidu_ocr@disabled', 'baidu_accurate_ocr@enabled'],
    service_instances: {
        'baidu_ocr@disabled': {
            serviceKey: 'baidu_ocr',
            config: { client_id: 'disabled', client_secret: 'disabled', enable: false },
        },
        'baidu_accurate_ocr@enabled': {
            serviceKey: 'baidu_accurate_ocr',
            config: { client_id: 'enabled', client_secret: 'enabled' },
        },
    },
}

async function expect_screenshot_closed(omni: AppFixture): Promise<void> {
    await expect.poll(async () => (await omni.api.windowState('screenshot')).exists).toBe(false)
}

async function expect_no_recognize_output(omni: AppFixture): Promise<void> {
    await expect.poll(async () => (await omni.api.windowState('recognize')).exists).toBe(false)
}

function color_alpha(color: string): number {
    const match = color.match(/^rgba?\(([^)]+)\)$/)
    if (!match) throw new Error(`Unexpected color format: ${color}`)
    const parts = match[1].split(',').map((part) => part.trim())
    return parts.length === 4 ? Number(parts[3]) : 1
}

async function expect_recognize_image_size(
    recognize: RecognizePage,
    expected_width: number,
    expected_height: number
): Promise<void> {
    await expect.poll(async () => recognize.image().locator('img').evaluate((image) => ({
        width: (image as HTMLImageElement).naturalWidth,
        height: (image as HTMLImageElement).naturalHeight,
    }))).toEqual({ width: expected_width, height: expected_height })
}

test.describe('@ui screenshot window', () => {
    test('user opens screenshot overlay and sees drag selection affordances', async () => {
        const omni = await AppFixture.start({ config: screenshot_config })

        try {
            const screenshot = await omni.triggerScreenshot('recognize')

            const state = await omni.api.windowState('screenshot')
            expect(state.visible).toBe(true)
            expect(state.alwaysOnTop).toBe(true)
            expect(state.bounds).not.toBeNull()
            const screen_size = await screenshot.screen_size()
            expect(state.bounds?.width ?? 0).toBeGreaterThanOrEqual(screen_size.width - 4)
            expect(state.bounds?.height ?? 0).toBeGreaterThanOrEqual(screen_size.height - 4)

            await expect(screenshot.root()).toBeVisible()
            await expect.poll(async () => await screenshot.root_background_image()).toContain('data:image/png;base64')
            await expect(screenshot.overlay()).toBeVisible()
            const overlay_color = await screenshot.overlay().evaluate((el) => getComputedStyle(el).backgroundColor)
            const overlay_alpha = color_alpha(overlay_color)
            expect(overlay_alpha).toBeGreaterThan(0)
            expect(overlay_alpha).toBeLessThan(1)
            await expect(screenshot.hint()).toContainText('拖动选取区域')
            await expect(screenshot.hint()).toContainText('确认')
            await expect(screenshot.hint()).toContainText('Esc')

            await screenshot.begin_selection(120, 120, 300, 240)
            await expect(screenshot.selection()).toBeVisible()
            await expect(screenshot.cornerHandles()).toHaveCount(4)
            await expect(screenshot.sizeLabel()).toContainText('180 × 120')
            const box = await screenshot.selection().boundingBox()
            expect(Math.round(box?.width ?? 0)).toBe(180)
            expect(Math.round(box?.height ?? 0)).toBe(120)

            await screenshot.release_selection()
            await expect_screenshot_closed(omni)
            const recognize = await omni.recognize()
            await expect(recognize.image().locator('img')).toBeVisible()
            await expect_recognize_image_size(recognize, 180, 120)
        } finally {
            await omni.stop()
        }
    })

    test('user presses Escape to cancel screenshot without output', async () => {
        const omni = await AppFixture.start({ config: screenshot_config })

        try {
            const screenshot = await omni.triggerScreenshot('recognize')
            await expect(screenshot.overlay()).toBeVisible()

            await screenshot.press_escape()

            await expect_screenshot_closed(omni)
            await expect_no_recognize_output(omni)
        } finally {
            await omni.stop()
        }
    })

    test('user releases mouse to capture selection into recognize window', async () => {
        const omni = await AppFixture.start({ config: screenshot_config })

        try {
            const screenshot = await omni.triggerScreenshot('recognize')
            await expect.poll(async () => await screenshot.root_background_image()).toContain('data:image/png;base64')

            await screenshot.drag_and_release(100, 100, 320, 260)

            await expect_screenshot_closed(omni)
            const recognize = await omni.recognize()
            await expect(recognize.image().locator('img')).toBeVisible()
            await expect_recognize_image_size(recognize, 220, 160)
            await expect(recognize.text()).toHaveValue('')
        } finally {
            await omni.stop()
        }
    })

    test('user captures screenshot and sees enabled OCR result while disabled service is skipped', async () => {
        const omni = await AppFixture.start({ config: screenshot_ocr_config })

        try {
            const screenshot = await omni.triggerScreenshot('recognize')
            await screenshot.fulfill_baidu_ocr_services('启用服务结果', '停用服务不应显示')
            await expect.poll(async () => await screenshot.root_background_image()).toContain('data:image/png;base64')

            await screenshot.drag_and_release(100, 100, 320, 260)

            await expect_screenshot_closed(omni)
            const recognize = await omni.recognize()
            await expect(recognize.image().locator('img')).toBeVisible()
            await expect(recognize.text()).toHaveValue('启用服务结果')
        } finally {
            await omni.stop()
        }
    })

    test('user right-clicks to cancel screenshot without output', async () => {
        const omni = await AppFixture.start({ config: screenshot_config })

        try {
            const screenshot = await omni.triggerScreenshot('recognize')
            await expect(screenshot.overlay()).toBeVisible()

            await screenshot.right_click(160, 160)

            await expect_screenshot_closed(omni)
            await expect_no_recognize_output(omni)
        } finally {
            await omni.stop()
        }
    })

    test('user presses Enter during selection to capture into recognize window', async () => {
        const omni = await AppFixture.start({ config: screenshot_config })

        try {
            const screenshot = await omni.triggerScreenshot('recognize')
            await expect.poll(async () => await screenshot.root_background_image()).toContain('data:image/png;base64')

            await screenshot.begin_selection(140, 130, 360, 290)
            await expect(screenshot.selection()).toBeVisible()
            await screenshot.press_enter()
            await expect_screenshot_closed(omni)

            const recognize_window = await omni.waitForWindow(/#recognize/)
            await recognize_window.mouse.up().catch(() => undefined)
            const recognize = await omni.recognize()
            await expect(recognize.image().locator('img')).toBeVisible()
            await expect_recognize_image_size(recognize, 220, 160)
        } finally {
            await omni.stop()
        }
    })
})
