import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import { local_operation_timeout_ms } from '../fixtures/timeout_constants'

type WindowLabel = 'translate' | 'dict' | 'recognize' | 'config'
const WINDOW_SIZE_DPI_RATIO_TOLERANCE = 0.35

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

test.describe('@ui app lifecycle', () => {
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
            expect((translate_state.bounds?.width ?? 0)).toBeGreaterThanOrEqual(430 * (1 - WINDOW_SIZE_DPI_RATIO_TOLERANCE))
            expect((translate_state.bounds?.width ?? 0)).toBeLessThanOrEqual(430 * (1 + WINDOW_SIZE_DPI_RATIO_TOLERANCE))
            // Without the welcome empty state, the translate window starts at its normal
            // initial height (~160), not the taller welcome size (~420).
            expect((translate_state.bounds?.height ?? 0)).toBeGreaterThanOrEqual(160 * (1 - WINDOW_SIZE_DPI_RATIO_TOLERANCE))
            expect((translate_state.bounds?.height ?? 0)).toBeLessThanOrEqual(160 * (1 + WINDOW_SIZE_DPI_RATIO_TOLERANCE))
        } finally {
            await omni.stop()
        }
    })

    test('first-run user sees config open automatically', async () => {
        const omni = await AppFixture.start({ firstRun: true, config: { translate_pinned: true, welcome_dismissed: true } })

        try {
            const translate = await omni.translate()
            const config = await omni.openConfig()

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
        const omni = await AppFixture.start({ config: { recognize_service_list: [], translate_pinned: true } })

        try {
            await omni.translate()
            const dict_result = await omni.api.triggerDict('hello')
            expect(dict_result.success).toBe(true)

            await expect_window_count(omni, 'translate', 1)
            await expect_window_count(omni, 'dict', 1)

            const dict_state = await omni.api.windowState('dict')
            expect(dict_state.exists).toBe(true)
            expect(dict_state.visible).toBe(true)

            const dict = await omni.dict()
            await dict.clickClose()
            await expect.poll(async () => (await omni.api.windowState('dict')).exists).toBe(false)

            await omni.openRecognize()
            await expect_window_count(omni, 'recognize', 1)
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
            await expect(translate.sourceInput()).toBeVisible()
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
