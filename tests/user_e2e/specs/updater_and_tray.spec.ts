import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const TEST_CONFIG = {
    app_language: 'en',
    check_update: false,
    dynamic_translate: false,
    translate_service_list: [],
}

type WindowLabel = 'translate' | 'config' | 'updater' | 'screenshot' | 'tray'

async function expect_window_visible(omni: AppFixture, label: WindowLabel): Promise<void> {
    await expect.poll(async () => (await omni.api.windowState(label)).visible).toBe(true)
}

async function expect_window_not_exists(omni: AppFixture, label: WindowLabel): Promise<void> {
    await expect.poll(async () => (await omni.api.windowState(label)).exists, { timeout: 20_000 }).toBe(false)
}

async function close_translate_window(omni: AppFixture): Promise<void> {
    if (!(await omni.api.windowState('translate')).exists) return
    const translate = await omni.translate()
    await translate.clickClose()
    await expect_window_not_exists(omni, 'translate')
}

test.describe('@ui updater and tray', () => {
    test('user sees mocked update details and closes the updater', async () => {
        const omni = await AppFixture.start({ config: TEST_CONFIG })
        try {
            const updater = await omni.mockUpdate({
                version: '2.0.0',
                current_version: '1.0.0',
                name: 'E2E Release 2.0.0',
                body: '### Changes\n- Added updater and tray coverage',
                html_url: 'https://example.invalid/omni_pot/releases/2.0.0',
                published_at: '2026-05-15T08:30:00.000Z',
                assets: [{
                    name: 'omni_pot-2.0.0-win.zip',
                    url: 'https://example.invalid/omni_pot-2.0.0-win.zip',
                }],
            })

            await expect(updater.titleMode()).toContainText('Update')
            await expect(updater.body()).toContainText('1.0.0 → 2.0.0')
            await expect(updater.body()).toContainText('2026-05-15')
            await expect(updater.changelog()).toContainText('Added updater and tray coverage')
            await expect(updater.downloadLink('omni_pot-2.0.0-win.zip')).toBeVisible()
            await expect(updater.confirmButton()).toBeEnabled()

            await updater.clickLater()
            await expect_window_not_exists(omni, 'updater')
        } finally {
            await omni.stop()
        }
    })

    test('screenshot hotkeys open the capture overlay', async () => {
        const omni = await AppFixture.start({
            config: {
                ...TEST_CONFIG,
                hotkey_ocr_recognize: 'CommandOrControl+Shift+Alt+F6',
                hotkey_ocr_translate: 'CommandOrControl+Shift+Alt+F5',
            },
        })

        try {
            const recognize_result = await omni.api.triggerHotkey('hotkey_ocr_recognize')
            expect(recognize_result.success).toBe(true)
            let screenshot = await omni.screenshot()
            await expect_window_visible(omni, 'screenshot')
            await expect(screenshot.overlay()).toBeVisible()
            await screenshot.press_escape()
            await expect_window_not_exists(omni, 'screenshot')

            const translate_result = await omni.api.triggerHotkey('hotkey_ocr_translate')
            expect(translate_result.success).toBe(true)
            screenshot = await omni.screenshot()
            await expect_window_visible(omni, 'screenshot')
            await expect(screenshot.overlay()).toBeVisible()
            await screenshot.press_escape()
            await expect_window_not_exists(omni, 'screenshot')
        } finally {
            await omni.stop()
        }
    })

    test('user opens a custom light tray popover instead of a native menu', async () => {
        const omni = await AppFixture.start({ config: { ...TEST_CONFIG, app_language: 'zh_cn', clipboard_monitor: false } })
        try {
            const result = await omni.api.trayAction('show_tray')
            expect(result.success).toBe(true)
            await expect_window_visible(omni, 'tray')
            const tray_page = await omni.waitForWindow(/#tray/)
            await expect(tray_page.getByTestId('tray-popover')).toBeVisible()
            await expect(tray_page.getByTestId('tray-action-input_translate')).toContainText('翻译')
            await expect(tray_page.getByTestId('tray-action-ocr_recognize')).toContainText('文字识别')
            await expect(tray_page.getByTestId('tray-action-clipboard_monitor')).toContainText('剪贴板监听')
            await expect(tray_page.getByTestId('tray-popover')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
        } finally {
            await omni.stop()
        }
    })

    test('user opens windows from tray actions and toggles clipboard monitor', async () => {
        const omni = await AppFixture.start({ config: { ...TEST_CONFIG, clipboard_monitor: false } })
        try {
            await close_translate_window(omni)

            const translate_result = await omni.api.trayAction('input_translate')
            expect(translate_result.success).toBe(true)
            const translate = await omni.translate()
            await expect_window_visible(omni, 'translate')

            const recognize_result = await omni.api.trayAction('ocr_recognize')
            expect(recognize_result.success).toBe(true)
            let screenshot = await omni.screenshot()
            await expect_window_visible(omni, 'screenshot')
            await expect(screenshot.overlay()).toBeVisible()
            await screenshot.press_escape()
            await expect_window_not_exists(omni, 'screenshot')

            const screenshot_translate_result = await omni.api.trayAction('screenshot_translate')
            expect(screenshot_translate_result.success).toBe(true)
            screenshot = await omni.screenshot()
            await expect_window_visible(omni, 'screenshot')
            await expect(screenshot.overlay()).toBeVisible()
            await screenshot.press_escape()
            await expect_window_not_exists(omni, 'screenshot')

            const config_result = await omni.api.trayAction('config')
            expect(config_result.success).toBe(true)
            const config = await omni.config()
            await expect(config.wordmark()).toContainText('Omni Pot')
            await expect_window_visible(omni, 'config')

            await expect.poll(async () => (await omni.api.getConfig()).clipboard_monitor).toBe(false)
            const enable_result = await omni.api.trayAction('clipboard_monitor')
            expect(enable_result.success).toBe(true)
            await expect.poll(async () => (await omni.api.getConfig()).clipboard_monitor).toBe(true)

            const current_clipboard = (await omni.api.readClipboard()).text
            const clipboard_text = current_clipboard === 'tray clipboard text' ? 'tray clipboard text changed' : 'tray clipboard text'
            const clipboard_result = await omni.api.triggerClipboard(clipboard_text)
            expect(clipboard_result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue(clipboard_text, { timeout: 10_000 })

            const disable_result = await omni.api.trayAction('clipboard_monitor')
            expect(disable_result.success).toBe(true)
            await expect.poll(async () => (await omni.api.getConfig()).clipboard_monitor).toBe(false)
        } finally {
            await omni.stop()
        }
    })

    test('user left-clicks tray and sees configured action', async () => {
        const show_config = await AppFixture.start({ config: { ...TEST_CONFIG, tray_click_event: 'show_config' } })
        try {
            const config_result = await show_config.api.trayAction('tray_click')
            expect(config_result.success).toBe(true)
            const config = await show_config.config()
            await expect(config.wordmark()).toContainText('Omni Pot')
            await expect_window_visible(show_config, 'config')
        } finally {
            await show_config.stop()
        }

        const show_translate = await AppFixture.start({ config: { ...TEST_CONFIG, tray_click_event: 'show_translate' } })
        try {
            await close_translate_window(show_translate)
            const translate_result = await show_translate.api.trayAction('tray_click')
            expect(translate_result.success).toBe(true)
            await expect_window_visible(show_translate, 'translate')
        } finally {
            await show_translate.stop()
        }

        const no_action = await AppFixture.start({ config: { ...TEST_CONFIG, tray_click_event: 'none' } })
        try {
            await close_translate_window(no_action)
            const no_action_result = await no_action.api.trayAction('tray_click')
            expect(no_action_result.success).toBe(true)
            await expect_window_not_exists(no_action, 'translate')
            await expect_window_not_exists(no_action, 'config')
        } finally {
            await no_action.stop()
        }
    })
})
