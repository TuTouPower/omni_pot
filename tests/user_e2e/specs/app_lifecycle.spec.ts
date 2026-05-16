import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

type WindowLabel = 'translate' | 'dict' | 'recognize' | 'config'
const WINDOW_SIZE_DPI_RATIO_TOLERANCE = 0.2

function is_target_closed_error(error: unknown): boolean {
    return error instanceof Error && error.message.includes('Target page, context or browser has been closed')
}

async function press_key_and_allow_close(page: Page, key: string): Promise<void> {
    try {
        await page.keyboard.press(key)
    } catch (error) {
        if (!is_target_closed_error(error)) throw error
    }
}

function window_count(omni: AppFixture, label: WindowLabel): number {
    return omni.app.windows().filter((page) => !page.isClosed() && page.url().includes(`#${label}`)).length
}

async function expect_window_count(omni: AppFixture, label: WindowLabel, count: number): Promise<void> {
    await expect.poll(() => Promise.resolve(window_count(omni, label))).toBe(count)
}

async function expect_window_visible(omni: AppFixture, label: WindowLabel): Promise<void> {
    await expect.poll(async () => (await omni.api.windowState(label)).visible).toBe(true)
}

async function expect_window_focused(omni: AppFixture, label: WindowLabel): Promise<void> {
    await expect.poll(async () => (await omni.api.windowState(label)).focused).toBe(true)
}

async function open_recognize_from_screenshot(omni: AppFixture): Promise<void> {
    const screenshot = await omni.triggerScreenshot('recognize')
    await expect(screenshot.hint()).toContainText('拖动选取区域')
    await screenshot.drag_and_release(40, 40, 180, 130)
}

test.describe('@core app lifecycle', () => {
    test('returning user starts the app and sees the default translate window without first-run config', async () => {
        const omni = await AppFixture.start()

        try {
            const translate = await omni.translate()
            await expect(translate.wordmark()).toContainText('Omni Pot')
            await expect(translate.sourceInput()).toBeVisible()

            const config_state = await omni.api.windowState('config')
            expect(config_state.exists).toBe(false)

            const translate_state = await omni.api.windowState('translate')
            expect(translate_state.visible).toBe(true)
            expect(translate_state.bounds).not.toBeNull()
            expect((translate_state.bounds?.width ?? 0)).toBeGreaterThanOrEqual(350 * (1 - WINDOW_SIZE_DPI_RATIO_TOLERANCE))
            expect((translate_state.bounds?.width ?? 0)).toBeLessThanOrEqual(350 * (1 + WINDOW_SIZE_DPI_RATIO_TOLERANCE))
            expect((translate_state.bounds?.height ?? 0)).toBeGreaterThanOrEqual(420 * (1 - WINDOW_SIZE_DPI_RATIO_TOLERANCE))
            expect((translate_state.bounds?.height ?? 0)).toBeLessThanOrEqual(420 * (1 + WINDOW_SIZE_DPI_RATIO_TOLERANCE))
        } finally {
            await omni.stop()
        }
    })

    test('first-run user sees config open automatically', async () => {
        const omni = await AppFixture.start({ firstRun: true })

        try {
            const translate = await omni.translate()
            const config = await omni.config()

            await expect(translate.wordmark()).toContainText('Omni Pot')
            await expect(config.wordmark()).toContainText('Omni Pot')
            await expect_window_visible(omni, 'config')
        } finally {
            await omni.stop()
        }
    })

    test('user opens the same window repeatedly and gets the existing focused window', async () => {
        const omni = await AppFixture.start()

        try {
            await omni.translate()
            await expect_window_count(omni, 'translate', 1)

            expect((await omni.api.trayAction('input_translate')).success).toBe(true)
            expect((await omni.api.trayAction('input_translate')).success).toBe(true)
            await expect_window_count(omni, 'translate', 1)
            await expect_window_focused(omni, 'translate')

            expect((await omni.api.trayAction('config')).success).toBe(true)
            await expect_window_count(omni, 'config', 1)
            expect((await omni.api.trayAction('config')).success).toBe(true)
            await expect_window_count(omni, 'config', 1)
            await expect_window_visible(omni, 'config')
            await expect_window_focused(omni, 'config')
        } finally {
            await omni.stop()
        }
    })

    test('user can keep translate, dictionary, and recognize windows open together', async () => {
        const omni = await AppFixture.start({ config: { recognize_service_list: [] } })

        try {
            await omni.translate()
            const dict_result = await omni.api.triggerDict('hello')
            expect(dict_result.success).toBe(true)
            await open_recognize_from_screenshot(omni)

            await expect_window_visible(omni, 'translate')
            await expect_window_visible(omni, 'dict')
            await expect_window_visible(omni, 'recognize')
            await expect_window_count(omni, 'translate', 1)
            await expect_window_count(omni, 'dict', 1)
            await expect_window_count(omni, 'recognize', 1)

            const dict = await omni.dict()
            await dict.clickClose()
            await expect.poll(async () => (await omni.api.windowState('dict')).exists).toBe(false)
            await expect_window_visible(omni, 'translate')
            await expect_window_visible(omni, 'recognize')
        } finally {
            await omni.stop()
        }
    })

    test('user closes the last visible window with Escape and the tray-resident app keeps running', async () => {
        const omni = await AppFixture.start()

        try {
            const translate_page = await omni.firstWindow()
            const translate = await omni.translate()
            await translate.sourceInput().click()
            await press_key_and_allow_close(translate_page, 'Escape')
            await expect.poll(async () => (await omni.api.windowState('translate')).exists).toBe(false)

            expect((await omni.api.trayAction('input_translate')).success).toBe(true)
            await expect_window_visible(omni, 'translate')
            const reopened_translate = await omni.translate()
            await expect(reopened_translate.wordmark()).toContainText('Omni Pot')
            await expect(reopened_translate.sourceInput()).toBeVisible()
        } finally {
            await omni.stop()
        }
    })
})
