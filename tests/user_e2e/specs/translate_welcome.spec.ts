import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

test.describe('@ui translate welcome empty state', () => {
    test('empty source shows welcome with configured hotkey hints', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                hotkey_selection_translate: 'CommandOrControl+Alt+T',
                hotkey_input_translate: 'CommandOrControl+Alt+I',
                hotkey_ocr_recognize: 'CommandOrControl+Alt+S',
                hotkey_ocr_translate: 'CommandOrControl+Alt+Shift+S',
            },
        })

        try {
            const translate = await omni.translate()
            const page = translate.sourceInput().page()

            const welcome = page.getByTestId('welcome-empty')
            await expect(welcome).toBeVisible()
            await expect(translate.sourceInput()).toHaveCount(0)
            await expect(translate.sourceLanguage()).toHaveCount(0)
            await expect(translate.targetLanguage()).toHaveCount(0)
            await expect(translate.resultCards()).toHaveCount(0)
            await expect(page.getByTestId('welcome-title')).toContainText('欢迎使用 Omni Pot')

            // Translate entry is merged into one (selection + input combined).
            await expect(page.getByTestId('welcome-translate')).toBeVisible()
            await expect(page.getByTestId('welcome-selection-translate')).toHaveCount(0)
            await expect(page.getByTestId('welcome-input-translate')).toHaveCount(0)
            await expect(page.getByTestId('welcome-ocr-recognize')).toContainText('文字识别')
            await expect(page.getByTestId('welcome-ocr-translate')).toContainText('截图翻译')

            const translate_kbd = page.getByTestId('welcome-translate').locator('kbd')
            await expect(translate_kbd).toHaveCount(3)
            await expect(translate_kbd.first()).toContainText('CommandOrControl')
            await expect(translate_kbd.last()).toContainText('T')
        } finally {
            await omni.stop()
        }
    })

    test('empty welcome fits height without changing window width', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                translate_remember_window_size: true,
                translate_window_width: 300,
                translate_window_height: 360,
            },
        })

        try {
            const translate = await omni.translate()
            const page = translate.sourceInput().page()

            await expect(page.getByTestId('welcome-empty')).toBeVisible()
            const initial_bounds = (await omni.api.windowState('translate')).bounds
            if (!initial_bounds) throw new Error('missing translate bounds')
            expect(initial_bounds.width).toBeLessThan(430)
            await expect.poll(async () => (await omni.api.windowState('translate')).bounds?.width).toBe(initial_bounds.width)

            const metrics = await page.getByTestId('welcome-empty').evaluate((el) => {
                const window_height = window.innerHeight
                const rect = el.getBoundingClientRect()
                return { window_height, content_bottom: Math.ceil(rect.bottom) }
            })
            expect(metrics.window_height).toBeGreaterThanOrEqual(metrics.content_bottom)
            expect(metrics.window_height - metrics.content_bottom).toBeLessThanOrEqual(80)
        } finally {
            await omni.stop()
        }
    })

    test('incoming source hides welcome and clearing source shows it again', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn', dynamic_translate: false, translate_service_list: [] } })

        try {
            const translate = await omni.translate()
            const page = translate.sourceInput().page()

            await expect(page.getByTestId('welcome-empty')).toBeVisible()
            expect((await omni.api.triggerSelection('hello')).success).toBe(true)
            await expect(page.getByTestId('welcome-empty')).toHaveCount(0)
            await translate.clickClearSource()
            await expect(page.getByTestId('welcome-empty')).toBeVisible()
        } finally {
            await omni.stop()
        }
    })

    test('skip dismisses welcome for the session', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const translate = await omni.translate()
            const page = translate.sourceInput().page()

            await expect(page.getByTestId('welcome-empty')).toBeVisible()
            await page.getByTestId('welcome-skip').click()
            await expect(page.getByTestId('welcome-empty')).toHaveCount(0)

            await translate.typeSource('hi')
            await translate.clickClearSource()
            await expect(page.getByTestId('welcome-empty')).toHaveCount(0)
        } finally {
            await omni.stop()
        }
    })

    test('unset hotkey shows not-set placeholder instead of kbd keys', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                hotkey_selection_translate: '',
                hotkey_input_translate: '',
                hotkey_ocr_recognize: '',
                hotkey_ocr_translate: '',
            },
        })

        try {
            const translate = await omni.translate()
            const page = translate.sourceInput().page()

            await expect(page.getByTestId('welcome-empty')).toBeVisible()
            await expect(page.getByTestId('welcome-translate-unset')).toContainText('未设置')
            await expect(page.getByTestId('welcome-translate').locator('kbd')).toHaveCount(0)
        } finally {
            await omni.stop()
        }
    })

    test('configure shortcuts button opens config and closes welcome window', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const translate = await omni.translate()
            const page = translate.sourceInput().page()

            await page.getByTestId('welcome-configure-hotkeys').click()
            const config = await omni.config()
            await expect(config.title()).toContainText('快捷键')

            // The translate (welcome) window must close after navigating to the config window.
            await expect.poll(async () => (await omni.api.windowState('translate')).exists,
                { timeout: 5_000 }).toBe(false)
        } finally {
            await omni.stop()
        }
    })
})
