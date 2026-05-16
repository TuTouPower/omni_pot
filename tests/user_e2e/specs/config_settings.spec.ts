import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const CONFIG_SECTIONS = [
    ['general', '通用'],
    ['translate', '翻译'],
    ['recognize', '识别'],
    ['hotkey', '快捷键'],
    ['service', '服务'],
    ['history', '历史'],
    ['backup', '备份'],
    ['about', '关于'],
] as const

async function expect_config(omni: AppFixture, key: string, value: unknown): Promise<void> {
    await expect.poll(async () => (await omni.api.getConfig())[key]).toEqual(value)
}

async function bind_hotkey(config: Awaited<ReturnType<AppFixture['openConfig']>>, hotkey: string, shortcut: string): Promise<void> {
    await config.hotkeyBindButton(hotkey).click()
    await config.hotkeyField(hotkey).press(shortcut)
    await config.hotkeyConfirmButton(hotkey).click()
}

test.describe('@ui config settings window', () => {
    test('user navigates the settings window and uses window controls', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()

            await expect(config.wordmark()).toContainText('Omni Pot')
            await expect.poll(async () => await config.hasHorizontalOverflow()).toBe(false)
            await expect.poll(async () => await config.appRegion('config-titlebar')).toBe('drag')
            await expect.poll(async () => await config.appRegion('config-pin')).toBe('no-drag')
            await expect.poll(async () => await config.appRegion('config-close')).toBe('no-drag')
            await expect(config.pinButton()).toBeVisible()
            await expect(config.version()).toContainText(/^v\d+\.\d+\.\d+$/)
            await expect(config.navItems()).toHaveCount(8)

            for (const [key, title] of CONFIG_SECTIONS) {
                await config.openSection(key)
                await expect(config.title()).toContainText(title)
                await expect(config.nav(key)).toHaveAttribute('aria-current', 'page')
            }

            await config.clickPin()
            await expect.poll(async () => (await omni.api.windowState('config')).alwaysOnTop).toBe(true)

            await config.clickClose()
            await expect.poll(async () => (await omni.api.windowState('config')).visible).toBe(false)
        } finally {
            await omni.stop()
        }
    })

    test('user changes general settings and the theme broadcasts to open windows', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn', app_theme: 'light', dev_mode: true } })

        try {
            const translate = await omni.translate()
            const config = await omni.openConfig()

            await expect.poll(async () => await translate.documentTheme()).toBe('light')
            await config.select('cfg-app_theme', 'dark')
            await expect.poll(async () => await config.documentTheme()).toBe('dark')
            await expect.poll(async () => await config.documentHasDarkClass()).toBe(true)
            await expect.poll(async () => await translate.documentTheme()).toBe('dark')
            await expect.poll(async () => await translate.documentHasDarkClass()).toBe(true)
            await expect_config(omni, 'app_theme', 'dark')

            await config.select('cfg-app_language', 'en')
            await expect_config(omni, 'app_language', 'en')
            await expect(config.title()).toContainText('General')
            await expect(config.window()).not.toContainText('Developer mode')
            await expect.poll(async () => 'dev_mode' in (await omni.api.getConfig())).toBe(false)

            await config.toggle('cfg-check_update')
            await config.toggle('cfg-auto_start')
            await config.select('cfg-app_font', 'Consolas')
            await config.select('cfg-app_font_size', '18')
            await config.fillField('cfg-server_port', '20444')

            await expect_config(omni, 'check_update', false)
            await expect_config(omni, 'auto_start', true)
            await expect_config(omni, 'app_font', 'Consolas')
            await expect_config(omni, 'app_font_size', 18)
            await expect_config(omni, 'server_port', 20444)

            if (await config.setting('cfg-transparent').count() > 0) {
                await config.toggle('cfg-transparent')
                await expect_config(omni, 'transparent', false)
            }
        } finally {
            await omni.stop()
        }
    })

    test('user changes translate and recognize settings and sees them persist', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()

            await config.openSection('translate')
            await config.setting('cfg-translate_source_language').click()
            await expect(config.selectOption('cfg-translate_source_language', 'en')).toContainText('English')
            await expect(config.selectOption('cfg-translate_source_language', 'ja')).toContainText('日本語')
            await expect.poll(async () => await config.optionReceivesPointer('cfg-translate_source_language', 'ja')).toBe(true)
            await config.clickOutsideSelects()
            await expect(config.selectOption('cfg-translate_source_language', 'ja')).toHaveCount(0)
            await config.select('cfg-translate_source_language', 'en')
            await config.select('cfg-translate_target_language', 'ja')
            await config.select('cfg-translate_second_language', 'en')
            await config.select('cfg-translate_detect_engine', 'local')
            await config.select('cfg-translate_auto_copy', 'source_target')
            await config.toggle('cfg-incremental_translate')
            await config.toggle('cfg-dynamic_translate')
            await config.toggle('cfg-translate_delete_newline')
            await config.toggle('cfg-translate_remember_language')
            await config.toggle('cfg-history_disable')
            await config.select('cfg-translate_window_position', 'pre_state')
            await config.toggle('cfg-translate_close_on_blur')
            await config.toggle('cfg-translate_always_on_top')
            await config.toggle('cfg-hide_source')
            await config.toggle('cfg-hide_language')
            await config.toggle('cfg-translate_hide_window')
            await config.toggle('cfg-translate_remember_window_size')

            await expect_config(omni, 'translate_source_language', 'en')
            await expect_config(omni, 'translate_target_language', 'ja')
            await expect_config(omni, 'translate_second_language', 'en')
            await expect_config(omni, 'translate_detect_engine', 'local')
            await expect_config(omni, 'translate_auto_copy', 'source_target')
            await expect_config(omni, 'incremental_translate', true)
            await expect_config(omni, 'dynamic_translate', true)
            await expect_config(omni, 'translate_delete_newline', true)
            await expect_config(omni, 'translate_remember_language', true)
            await expect_config(omni, 'history_disable', true)
            await expect_config(omni, 'translate_window_position', 'pre_state')
            await expect_config(omni, 'translate_close_on_blur', true)
            await expect_config(omni, 'translate_always_on_top', true)
            await expect_config(omni, 'hide_source', true)
            await expect_config(omni, 'hide_language', true)
            await expect_config(omni, 'translate_hide_window', true)
            await expect_config(omni, 'translate_remember_window_size', true)

            await config.openSection('recognize')
            await config.select('cfg-recognize_language', 'en')
            await config.toggle('cfg-recognize_delete_newline')
            await config.toggle('cfg-recognize_auto_copy')
            await config.toggle('cfg-recognize_close_on_blur')
            await config.toggle('cfg-recognize_hide_window')

            await expect_config(omni, 'recognize_language', 'en')
            await expect_config(omni, 'recognize_delete_newline', true)
            await expect_config(omni, 'recognize_auto_copy', true)
            await expect_config(omni, 'recognize_close_on_blur', true)
            await expect_config(omni, 'recognize_hide_window', true)
        } finally {
            await omni.stop()
        }
    })

    test('user records and clears a hotkey with visible registration status', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })
        const hotkey = 'hotkey_selection_translate'

        try {
            const config = await omni.openConfig()
            await config.openSection('hotkey')
            await expect(config.window()).not.toContainText('Wayland 用户')

            await bind_hotkey(config, hotkey, 'Control+Alt+Shift+F9')
            await expect(config.hotkeyStatus(hotkey)).toContainText('绑定成功')
            await expect_config(omni, hotkey, 'CommandOrControl+Shift+Alt+F9')

            await config.hotkeyBindButton(hotkey).click()
            await config.hotkeyField(hotkey).press('Backspace')
            await config.hotkeyConfirmButton(hotkey).click()
            await expect(config.hotkeyStatus(hotkey)).toContainText('已清除')
            await expect_config(omni, hotkey, '')
        } finally {
            await omni.stop()
        }
    })

    test('user sees a conflict when another action already uses the same hotkey', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })
        const firstHotkey = 'hotkey_selection_translate'
        const secondHotkey = 'hotkey_input_translate'
        const shortcut = 'CommandOrControl+Shift+Alt+F9'

        try {
            const config = await omni.openConfig()
            await config.openSection('hotkey')

            await bind_hotkey(config, firstHotkey, 'Control+Alt+Shift+F9')
            await expect(config.hotkeyStatus(firstHotkey)).toContainText('绑定成功')
            await expect_config(omni, firstHotkey, shortcut)

            await bind_hotkey(config, secondHotkey, 'Control+Alt+Shift+F9')
            await expect(config.hotkeyStatus(secondHotkey)).toContainText('快捷键冲突')
            await expect_config(omni, firstHotkey, shortcut)
            await expect_config(omni, secondHotkey, '')
        } finally {
            await omni.stop()
        }
    })

    test('user sees failure when the system refuses to register a hotkey', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })
        const hotkey = 'hotkey_ocr_recognize'
        const shortcut = 'CommandOrControl+Shift+Alt+F10'

        try {
            const system_failures = await omni.api.setHotkeySystemFailures([shortcut])
            expect(system_failures.success).toBe(true)

            const config = await omni.openConfig()
            await config.openSection('hotkey')

            await bind_hotkey(config, hotkey, 'Control+Alt+Shift+F10')
            await expect(config.hotkeyStatus(hotkey)).toContainText('绑定失败')
            await expect_config(omni, hotkey, '')
        } finally {
            await omni.stop()
        }
    })

    test('user sees about links and diagnostics', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()
            await config.openSection('about')

            await expect(config.aboutVersion()).toContainText(/version \d+\.\d+\.\d+/)
            await expect(config.aboutLink('home')).toContainText('官网')
            await expect(config.aboutLink('docs')).toContainText('文档')
            await expect(config.aboutLink('feedback')).toContainText('反馈')
            await expect(config.aboutCheckUpdate()).toContainText('检查更新')
            await expect(config.aboutCheckUpdate()).not.toContainText('about.check_update')
            await expect(config.aboutDiagnostic('about-config-dir')).toContainText('config.json')
            await expect(config.aboutDiagnostic('about-log-dir')).toContainText('logs')
            await expect(config.aboutDiagnostic('about-api-url')).toContainText(/http:\/\/127\.0\.0\.1:\d+/)
        } finally {
            await omni.stop()
        }
    })
})
