import { type Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

async function expect_welcome_closed(omni: AppFixture): Promise<void> {
    await expect.poll(async () => (await omni.api.windowState('welcome')).exists, { timeout: 5_000 }).toBe(false)
}

async function close_welcome_without_dismiss(page: Page): Promise<void> {
    const close_promise = page.waitForEvent('close').catch(() => undefined)
    await page.getByTestId('titlebar-close').click().catch((error: unknown) => {
        if (!page.isClosed()) throw error
    })
    await close_promise
}

test.describe('@ui standalone welcome window', () => {
    test('startup opens standalone welcome with configured hotkey hints', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                welcome_dismissed: false,
                hotkey_translate: 'CommandOrControl+Alt+T',
                hotkey_ocr_recognize: 'CommandOrControl+Alt+S',
                hotkey_ocr_translate: 'CommandOrControl+Alt+Shift+S',
            },
        })

        try {
            const page = await omni.welcome()
            await expect(page).toHaveURL(/#welcome/)
            await expect(page.getByTestId('welcome-empty')).toBeVisible()
            await expect(page.getByTestId('titlebar-mode')).not.toContainText('翻译')
            await expect(page.getByTestId('titlebar-pin')).toHaveCount(0)
            await expect(page.getByTestId('titlebar-topmost')).toHaveCount(0)
            await expect(page.getByTestId('source-input')).toHaveCount(0)
            await expect(page.getByTestId('lang-source')).toHaveCount(0)
            await expect(page.getByTestId('lang-target')).toHaveCount(0)
            await expect(page.getByTestId('welcome-title')).toContainText('欢迎使用 Omni Pot')
            await expect(page.getByTestId('welcome-empty')).not.toContainText(/welcome\./)

            await expect(page.getByTestId('welcome-translate')).toContainText('翻译')
            await expect(page.getByTestId('welcome-selection-translate')).toHaveCount(0)
            await expect(page.getByTestId('welcome-input-translate')).toHaveCount(0)
            await expect(page.getByTestId('welcome-dictionary')).toContainText('词典')
            await expect(page.getByTestId('welcome-ocr-recognize')).toContainText('文字识别')
            await expect(page.getByTestId('welcome-ocr-translate')).toContainText('截图翻译')

            const translate_kbd = page.getByTestId('welcome-translate').locator('kbd')
            await expect(translate_kbd).toHaveCount(3)
            await expect(translate_kbd.first()).toContainText('Ctrl')
            await expect(translate_kbd.last()).toContainText('T')
            await expect(page.getByTestId('welcome-empty')).not.toContainText('CommandOrControl')
        } finally {
            await omni.stop()
        }
    })

    test('welcome buttons close welcome and open target windows', async () => {
        const cases: Array<{ test_id: string; target: 'translate' | 'dict' | 'config'; assert_target?: (omni: AppFixture) => Promise<void> }> = [
            {
                test_id: 'welcome-translate',
                target: 'translate',
                assert_target: async (omni) => {
                    const translate = await omni.translate()
                    await expect(translate.sourceInput()).toBeVisible()
                },
            },
            { test_id: 'welcome-dictionary', target: 'dict' },
            {
                test_id: 'welcome-configure-hotkeys',
                target: 'config',
                assert_target: async (omni) => {
                    const config = await omni.config()
                    await expect(config.title()).toContainText('快捷键')
                    await expect(config.nav('hotkey')).toHaveAttribute('aria-current', 'page')
                },
            },
        ]

        for (const item of cases) {
            const omni = await AppFixture.start({ config: { app_language: 'zh_cn', welcome_dismissed: false } })
            try {
                const page = await omni.welcome()
                await page.getByTestId(item.test_id).click()
                await expect_welcome_closed(omni)
                if (item.assert_target) await item.assert_target(omni)
                else await expect.poll(async () => (await omni.api.windowState(item.target)).exists).toBe(true)
            } finally {
                await omni.stop()
            }
        }
    })

    test('welcome screenshot entries close welcome and open screenshot action', async () => {
        for (const test_id of ['welcome-ocr-recognize', 'welcome-ocr-translate']) {
            const omni = await AppFixture.start({ config: { app_language: 'zh_cn', welcome_dismissed: false } })
            try {
                const page = await omni.welcome()
                await page.getByTestId(test_id).click()
                await expect_welcome_closed(omni)
                await expect.poll(async () => (await omni.api.windowState('screenshot')).exists, { timeout: 5_000 }).toBe(true)
            } finally {
                await omni.stop()
            }
        }
    })

    test('empty translate window shows normal input and language area, not welcome', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn', welcome_dismissed: true, translate_service_list: [] } })

        try {
            const translate = await omni.translate()
            const page = translate.sourceInput().page()
            await expect(page.getByTestId('welcome-empty')).toHaveCount(0)
            await expect(translate.sourceInput()).toBeVisible()
            await expect(translate.sourceLanguage()).toBeVisible()
            await expect(translate.targetLanguage()).toBeVisible()
        } finally {
            await omni.stop()
        }
    })

    test('empty translate hotkey opens translate input without welcome flash', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn', welcome_dismissed: false, translate_service_list: [] } })

        try {
            const welcome = await omni.welcome()
            await close_welcome_without_dismiss(welcome)
            await expect_welcome_closed(omni)

            await omni.api.triggerHotkey('translate', '')
            const translate = await omni.translate()
            await expect(translate.sourceInput()).toBeVisible()
            await expect(translate.page.getByTestId('welcome-empty')).toHaveCount(0)
            await expect.poll(async () => (await omni.api.windowState('welcome')).exists).toBe(false)
        } finally {
            await omni.stop()
        }
    })

    test('skip persists dismissed state and skipped restart has no welcome', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn', welcome_dismissed: false } })

        try {
            const page = await omni.welcome()
            await page.getByTestId('welcome-skip').click()
            await expect_welcome_closed(omni)
            await expect.poll(async () => (await omni.api.getConfig()).welcome_dismissed).toBe(true)

            await omni.restart()

            await expect.poll(async () => (await omni.api.windowState('welcome')).exists).toBe(false)
            const translate = await omni.translate()
            await expect(translate.sourceInput()).toBeVisible()
        } finally {
            await omni.stop()
        }
    })

    test('unset hotkey shows not-set placeholder instead of kbd keys', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                welcome_dismissed: false,
                hotkey_translate: '',
                hotkey_ocr_recognize: '',
                hotkey_ocr_translate: '',
            },
        })

        try {
            const page = await omni.welcome()
            await expect(page.getByTestId('welcome-empty')).toBeVisible()
            await expect(page.getByTestId('welcome-translate-unset')).toContainText('未设置')
            await expect(page.getByTestId('welcome-translate').locator('kbd')).toHaveCount(0)
        } finally {
            await omni.stop()
        }
    })
})
