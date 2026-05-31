import http from 'http'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const TEST_CONFIG = {
    app_language: 'en',
    check_update: false,
    dynamic_translate: false,
    translate_service_list: [],
}

type WindowLabel = 'translate' | 'config' | 'updater' | 'screenshot' | 'tray'

const REQUIRED_TRAY_ACTIONS = [
    'tray-action-input_translate',
    'tray-action-dictionary',
    'tray-action-ocr_recognize',
    'tray-action-screenshot_translate',
    'tray-action-clipboard_monitor',
    'tray-action-config',
    'tray-action-support_author',
    'tray-action-check_update',
    'tray-action-view_log',
    'tray-action-restart',
    'tray-action-quit',
] as const

async function start_update_asset_server(body: Buffer): Promise<{ url: string; requests: string[]; stop(): Promise<void> }> {
    const requests: string[] = []
    const server = http.createServer((req, res) => {
        requests.push(req.url ?? '')
        if (req.url !== '/omni_pot-e2e-update.bin') {
            res.writeHead(404)
            res.end('not found')
            return
        }
        const split_at = Math.max(1, Math.floor(body.length / 2))
        res.writeHead(200, {
            'content-length': String(body.length),
            'content-type': 'application/octet-stream',
        })
        res.write(body.subarray(0, split_at))
        setTimeout(() => { res.end(body.subarray(split_at)) }, 100)
    })

    const port = await new Promise<number>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            resolve(address && typeof address === 'object' ? address.port : 0)
        })
    })

    return {
        url: `http://127.0.0.1:${String(port)}/omni_pot-e2e-update.bin`,
        requests,
        stop: () => new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error)
                else resolve()
            })
        }),
    }
}

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
                version: '3.1.0',
                current_version: '3.0.6',
                name: 'E2E Release 3.1.0',
                body: '### Changes\n- Added updater and tray coverage',
                html_url: 'https://example.invalid/omni_pot/releases/3.1.0',
                published_at: '2026-05-15T08:30:00.000Z',
                assets: [{
                    name: 'omni_pot-3.1.0-win.zip',
                    url: 'https://example.invalid/omni_pot-3.1.0-win.zip',
                    size: 5 * 1024 * 1024,
                }],
            })

            await expect(updater.titleMode()).toContainText('Update')
            await expect(updater.releaseMeta()).toHaveText('3.0.6 → 3.1.0 · 2026-05-15 · 5.0 MB')
            await expect(updater.changelog()).toContainText('Added updater and tray coverage')
            await expect(updater.downloadLink('omni_pot-3.1.0-win.zip')).toBeVisible()
            await expect(updater.confirmButton()).toBeEnabled()

            await updater.clickLater()
            await expect_window_not_exists(omni, 'updater')
        } finally {
            await omni.stop()
        }
    })

    test('user downloads an update asset and sees progress complete', async () => {
        const asset_body = Buffer.alloc(64 * 1024, 'a')
        const asset_server = await start_update_asset_server(asset_body)
        const omni = await AppFixture.start({ config: TEST_CONFIG })
        try {
            const updater = await omni.mockUpdate({
                version: '2.0.1',
                current_version: '1.0.0',
                name: 'E2E Release 2.0.1',
                body: '### Changes\n- Added download coverage',
                html_url: 'https://example.invalid/omni_pot/releases/2.0.1',
                published_at: '2026-05-16T08:30:00.000Z',
                assets: [{
                    name: 'omni_pot-e2e-update.bin',
                    url: asset_server.url,
                    size: asset_body.length,
                }],
            })

            await expect(updater.confirmButton()).toContainText('Update Now')
            await updater.clickConfirm()
            await expect(updater.progress()).toBeVisible()
            await expect(updater.progressPercent()).toContainText('100', { timeout: 20_000 })
            await expect(updater.confirmButton()).toContainText('Download complete')
            expect(asset_server.requests).toContain('/omni_pot-e2e-update.bin')
        } finally {
            await asset_server.stop()
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
            const popover = tray_page.getByTestId('tray-popover')
            await expect(popover).toBeVisible()
            await expect(tray_page.getByTestId('tray-action-input_translate')).toContainText('翻译')
            await expect(tray_page.getByTestId('tray-action-ocr_recognize')).toContainText('文字识别')
            await expect(tray_page.getByTestId('tray-action-clipboard_monitor')).toContainText('剪贴板监听')
            await expect(popover).toHaveCSS('background-color', 'rgb(255, 255, 255)')
            await expect(popover).not.toContainText('CommandOrControl')

            for (const testid of REQUIRED_TRAY_ACTIONS) {
                const item = tray_page.getByTestId(testid)
                await expect(item, `missing tray item: ${testid}`).toBeVisible()
                const item_text = await item.innerText()
                expect(item_text.trim(), `tray item ${testid} should have visible text`).not.toBe('')
            }

            const separator_count = await tray_page.locator('[data-testid="tray-separator"]').count()
            expect(separator_count, '托盘菜单需有分组分隔线').toBeGreaterThanOrEqual(2)

            const popover_box = await popover.boundingBox()
            const quit_box = await tray_page.getByTestId('tray-action-quit').boundingBox()
            if (!popover_box) throw new Error('missing tray popover box')
            if (!quit_box) throw new Error('missing tray quit item box')
            expect(quit_box.y + quit_box.height).toBeLessThanOrEqual(popover_box.y + popover_box.height + 1)

            const item_locators = REQUIRED_TRAY_ACTIONS.map((id) => tray_page.getByTestId(id))
            const item_boxes = await Promise.all(item_locators.map(async (locator) => locator.boundingBox()))
            for (let i = 0; i < item_boxes.length - 1; i += 1) {
                const top = item_boxes[i]
                const bottom = item_boxes[i + 1]
                if (!top || !bottom) continue
                const gap = bottom.y - (top.y + top.height)
                expect(gap, `tray item gap between ${REQUIRED_TRAY_ACTIONS[i]} and ${REQUIRED_TRAY_ACTIONS[i + 1]} is too large`)
                    .toBeLessThanOrEqual(20)
            }
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
            await omni.translate()
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
            const reopen_translate_result = await omni.api.openWindow('translate')
            expect(reopen_translate_result.success).toBe(true)
            const translate_after_config = await omni.translate()

            const current_clipboard = (await omni.api.readClipboard()).text
            const clipboard_text = current_clipboard === 'tray clipboard text' ? 'tray clipboard text changed' : 'tray clipboard text'
            const clipboard_result = await omni.api.triggerClipboard(clipboard_text)
            expect(clipboard_result.success).toBe(true)
            await expect(translate_after_config.sourceInput()).toHaveValue(clipboard_text, { timeout: 10_000 })

            const disable_result = await omni.api.trayAction('clipboard_monitor')
            expect(disable_result.success).toBe(true)
            await expect.poll(async () => (await omni.api.getConfig()).clipboard_monitor).toBe(false)
        } finally {
            await omni.stop()
        }
    })

    test('user triggers restart and quit from tray actions', async () => {
        const omni = await AppFixture.start({ config: TEST_CONFIG })
        try {
            const restart_result = await omni.api.trayAction('restart')
            expect(restart_result).toEqual({ success: true, action: 'restart' })

            const quit_result = await omni.api.trayAction('quit')
            expect(quit_result).toEqual({ success: true, action: 'quit' })

            const translate_result = await omni.api.trayAction('input_translate')
            expect(translate_result.success).toBe(true)
            await expect_window_visible(omni, 'translate')
        } finally {
            await omni.stop()
        }
    })

    test('support_author tray action opens external link and closes popup', async () => {
        const omni = await AppFixture.start({ config: { ...TEST_CONFIG, app_language: 'zh_cn' } })
        try {
            await omni.api.trayAction('show_tray')
            await expect_window_visible(omni, 'tray')
            const tray_page = await omni.waitForWindow(/#tray/)
            const support_item = tray_page.getByTestId('tray-action-support_author')
            await expect(support_item).toBeVisible()
            await expect(support_item).toContainText('支持作者')
            await expect(support_item).toHaveCSS('color', 'rgb(155, 89, 182)')

            const result = await omni.api.trayAction('support_author')
            expect(result.success).toBe(true)
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
