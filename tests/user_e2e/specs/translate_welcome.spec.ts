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
            await expect(page.getByTestId('welcome-title')).toContainText('欢迎使用 Omni Pot')
            await expect(page.getByTestId('welcome-selection-translate')).toContainText('划词翻译')
            await expect(page.getByTestId('welcome-input-translate')).toContainText('输入翻译')
            await expect(page.getByTestId('welcome-ocr-recognize')).toContainText('OCR 识别')
            await expect(page.getByTestId('welcome-ocr-translate')).toContainText('OCR 翻译')

            const selection_kbd = page.getByTestId('welcome-selection-translate').locator('kbd')
            await expect(selection_kbd).toHaveCount(3)
            await expect(selection_kbd.first()).toContainText('CommandOrControl')
            await expect(selection_kbd.last()).toContainText('T')
        } finally {
            await omni.stop()
        }
    })

    test('typing source hides welcome and clearing source shows it again', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const translate = await omni.translate()
            const page = translate.sourceInput().page()

            await expect(page.getByTestId('welcome-empty')).toBeVisible()
            await translate.typeSource('hello')
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
            await expect(page.getByTestId('welcome-selection-translate-unset')).toContainText('未设置')
            await expect(page.getByTestId('welcome-selection-translate').locator('kbd')).toHaveCount(0)
        } finally {
            await omni.stop()
        }
    })

    test('configure shortcuts button opens config window on hotkey section', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const translate = await omni.translate()
            const page = translate.sourceInput().page()

            await page.getByTestId('welcome-configure-hotkeys').click()
            const config = await omni.config()
            await expect(config.title()).toContainText('快捷键')
        } finally {
            await omni.stop()
        }
    })
})
