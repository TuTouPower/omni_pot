import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import { local_operation_timeout_ms } from '../fixtures/timeout_constants'

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
            await expect.poll(async () => await config.appRegion('config-close')).toBe('no-drag')
            await expect(config.pinButton()).toHaveCount(0)
            await expect(config.version()).toContainText(/^v\d+\.\d+\.\d+$/)
            await expect(config.navItems()).toHaveCount(8)

            for (const [key, title] of CONFIG_SECTIONS) {
                await config.openSection(key)
                await expect(config.title()).toContainText(title)
                await expect(config.nav(key)).toHaveAttribute('aria-current', 'page')
            }

            await config.clickClose()
            await expect.poll(async () => (await omni.api.windowState('config')).visible).toBe(false)
        } finally {
            await omni.stop()
        }
    })

    test('user changes general settings and the theme broadcasts to open windows', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn', app_theme: 'light', app_primary_color: '#bad', transparent: true, dev_mode: true, translate_always_on_top: true, welcome_dismissed: true } })

        try {
            let translate = await omni.translate()
            await translate.clickPin()
            const config = await omni.openConfig()

            await expect.poll(async () => await translate.documentTheme()).toBe('light')
            await expect.poll(async () => await translate.documentPrimaryColor()).toBe('#5a9bbf')
            await expect_config(omni, 'app_primary_color', '#5a9bbf')
            await expect.poll(async () => await translate.documentTransparent()).toBe('true')
            await expect.poll(async () => (await omni.api.windowState('translate')).transparent).toBe(true)
            await config.setting('cfg-app_theme-dark').click()
            await expect.poll(async () => await config.documentTheme()).toBe('dark')
            await expect.poll(async () => await config.documentHasDarkClass()).toBe(true)
            translate = await omni.translate(local_operation_timeout_ms)
            await expect.poll(async () => await translate.documentTheme()).toBe('dark')
            await expect.poll(async () => await translate.documentHasDarkClass()).toBe(true)
            await expect_config(omni, 'app_theme', 'dark')

            await expect(config.primaryColorButtons()).toHaveCount(5)
            await expect(config.setting('cfg-app_primary_color-sky')).toHaveAttribute('aria-pressed', 'true')
            await config.setting('cfg-app_primary_color-ultramarine').click()
            await expect(config.setting('cfg-app_primary_color-ultramarine')).toHaveAttribute('aria-pressed', 'true')
            await expect.poll(async () => await config.documentPrimaryColor()).toBe('#3a6ea5')
            await expect.poll(async () => await translate.documentPrimaryColor()).toBe('#3a6ea5')
            await expect_config(omni, 'app_primary_color', '#3a6ea5')

            await config.select('cfg-app_language', 'en')
            await expect_config(omni, 'app_language', 'en')
            await expect(config.title()).toContainText('General')
            await expect(config.window()).not.toContainText('Developer mode')
            await expect.poll(async () => 'dev_mode' in (await omni.api.getConfig())).toBe(false)

            await config.toggle('cfg-check_update')
            await config.toggle('cfg-auto_start')
            await config.fillField('cfg-server_port', '20444')

            await expect_config(omni, 'check_update', false)
            await expect_config(omni, 'auto_start', true)
            await expect_config(omni, 'server_port', 20444)

            await expect(config.setting('cfg-transparent')).toBeVisible()
            await config.toggle('cfg-transparent')
            await expect.poll(async () => await config.documentTransparent()).toBe('false')
            await expect.poll(async () => (await omni.api.windowState('translate')).transparent).toBe(false)
            translate = await omni.translate(local_operation_timeout_ms)
            await expect.poll(async () => await translate.documentTransparent()).toBe('false')
            await expect_config(omni, 'transparent', false)

            await translate.clickClose()
            await expect.poll(async () => (await omni.api.windowState('translate')).visible).toBe(false)
            const input_result = await omni.api.triggerInputTranslate()
            expect(input_result.success).toBe(true)
            await expect.poll(async () => (await omni.api.windowState('translate')).transparent).toBe(false)

            const opaque_translate = await omni.translate()
            await opaque_translate.clickClose()
            await expect.poll(async () => (await omni.api.windowState('translate')).visible).toBe(false)
            await config.toggle('cfg-transparent')
            await expect_config(omni, 'transparent', true)
            const transparent_result = await omni.api.triggerInputTranslate()
            expect(transparent_result.success).toBe(true)
            await expect.poll(async () => (await omni.api.windowState('translate')).transparent).toBe(true)
        } finally {
            await omni.stop()
        }
    })

    test('user changes translate and recognize settings and sees them persist', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()

            await config.openSection('translate')
            await expect(config.setting('cfg-translate_detect_engine')).toHaveCount(0)
            await expect(config.setting('cfg-translate_remember_language')).toHaveCount(0)
            await expect(config.setting('cfg-translate_source_language')).toHaveAttribute('role', 'combobox')
            await expect(config.setting('cfg-translate_source_language')).toHaveAttribute('aria-expanded', 'false')
            await config.setting('cfg-translate_source_language').click()
            await expect(config.setting('cfg-translate_source_language')).toHaveAttribute('aria-expanded', 'true')
            await expect(config.selectOption('cfg-translate_source_language', 'en')).toHaveAttribute('role', 'option')
            await expect(config.selectOption('cfg-translate_source_language', 'en')).toContainText('English')
            await expect(config.selectOption('cfg-translate_source_language', 'ja')).toContainText('日本語')
            await expect.poll(async () => await config.optionReceivesPointer('cfg-translate_source_language', 'ja')).toBe(true)
            await config.clickOutsideSelects()
            await expect(config.selectOption('cfg-translate_source_language', 'ja')).toHaveCount(0)
            await config.select('cfg-translate_source_language', 'en')
            await config.select('cfg-translate_target_language', 'ja')
            await config.select('cfg-translate_second_language', 'en')
            await config.toggle('cfg-translate_auto_copy')
            await config.toggle('cfg-incremental_translate')
            await config.toggle('cfg-dynamic_translate')
            await config.toggle('cfg-translate_delete_newline')
            await config.toggle('cfg-history_disable')
            await config.setting('cfg-translate_window_position').focus()
            await config.setting('cfg-translate_window_position').press('ArrowDown')
            await expect(config.setting('cfg-translate_window_position')).toHaveAttribute('aria-expanded', 'true')
            await config.setting('cfg-translate_window_position').press('ArrowDown')
            await config.setting('cfg-translate_window_position').press('Enter')
            await config.toggle('cfg-translate_always_on_top')
            await config.toggle('cfg-hide_source')
            await config.toggle('cfg-hide_language')
            await config.toggle('cfg-translate_hide_window')
            await config.toggle('cfg-translate_remember_window_size')

            await expect_config(omni, 'translate_source_language', 'en')
            await expect_config(omni, 'translate_target_language', 'ja')
            await expect_config(omni, 'translate_second_language', 'en')
            await expect_config(omni, 'translate_auto_copy', true)
            await expect_config(omni, 'incremental_translate', true)
            await expect_config(omni, 'dynamic_translate', true)
            await expect_config(omni, 'translate_delete_newline', true)
            await expect_config(omni, 'history_disable', true)
            await expect_config(omni, 'translate_window_position', 'pre_state')
            await expect_config(omni, 'translate_always_on_top', true)
            await expect_config(omni, 'hide_source', true)
            await expect_config(omni, 'hide_language', true)
            await expect_config(omni, 'translate_hide_window', true)
            await expect_config(omni, 'translate_remember_window_size', false)

            await config.openSection('recognize')
            await expect(config.setting('cfg-recognize_close_on_blur')).toHaveCount(0)
            await expect(config.setting('cfg-recognize_hide_window')).toHaveCount(0)
            await expect(config.setting('cfg-recognize_engine')).toBeVisible()
            await config.select('cfg-recognize_language', 'en')
            await config.toggle('cfg-recognize_delete_newline')
            await config.toggle('cfg-recognize_auto_copy')

            await expect_config(omni, 'recognize_engine', 'tesseract@default')
            await expect_config(omni, 'recognize_language', 'en')
            await expect_config(omni, 'recognize_delete_newline', true)
            await expect_config(omni, 'recognize_auto_copy', false)
        } finally {
            await omni.stop()
        }
    })

    test('user sees general page layout: API port help button, no proxy, text row, theme segmented control', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()

            // Spec §9.3: 本地 API 端口标签右侧有问号按钮，点击打开 API 文档。
            const help_link = config.page.locator('a.label-help[title="API 文档"]')
            await expect(help_link).toBeVisible()
            await expect(help_link).toContainText('?')
            await expect(help_link).toHaveAttribute('href', /api\.md/)

            // Spec §9.3: 不提供代理功能，不显示代理设置卡片。
            await expect(config.page.locator('body')).not.toContainText('代理')
            await expect(config.page.locator('[data-testid*="proxy"]')).toHaveCount(0)

            // Spec §9.3: 外观卡片含主题三按钮分段控件、主色调、透明背景、托盘点击行为；文字选项已移除。
            await expect(config.setting('cfg-app_font')).toHaveCount(0)
            await expect(config.setting('cfg-app_font_size')).toHaveCount(0)

            // Spec §9.3: 主题用三按钮分段控件（非下拉）。
            await expect(config.setting('cfg-app_theme-system')).toBeVisible()
            await expect(config.setting('cfg-app_theme-light')).toBeVisible()
            await expect(config.setting('cfg-app_theme-dark')).toBeVisible()
        } finally {
            await omni.stop()
        }
    })

    test('user records and clears a hotkey with visible registration status', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })
        const hotkey = 'hotkey_translate'

        try {
            const config = await omni.openConfig()
            await config.openSection('hotkey')
            await expect(config.window()).not.toContainText('Wayland 用户')

            await bind_hotkey(config, hotkey, 'Control+Alt+Shift+F9')
            await expect(config.hotkeyStatus(hotkey)).not.toBeVisible()
            await expect_config(omni, hotkey, 'CommandOrControl+Shift+Alt+F9')

            // Spec §9.6: 快捷键展示必须按平台把 CommandOrControl 解析成用户可读修饰键。
            await expect(config.hotkeyField(hotkey)).not.toContainText('CommandOrControl')
            await expect(config.hotkeyField(hotkey)).toContainText('Ctrl')

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
        const firstHotkey = 'hotkey_translate'
        const secondHotkey = 'hotkey_selection_dictionary'
        const shortcut = 'CommandOrControl+Shift+Alt+F9'

        try {
            const config = await omni.openConfig()
            await config.openSection('hotkey')

            await bind_hotkey(config, firstHotkey, 'Control+Alt+Shift+F9')
            await expect(config.hotkeyStatus(firstHotkey)).not.toBeVisible()
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

    test('user records a hotkey and the previous recording field exits automatically', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })
        const firstHotkey = 'hotkey_translate'
        const secondHotkey = 'hotkey_selection_dictionary'

        try {
            const config = await omni.openConfig()
            await config.openSection('hotkey')

            // Start recording on the first hotkey
            await config.hotkeyBindButton(firstHotkey).click()
            await expect(config.hotkeyField(firstHotkey)).toContainText('按下快捷键')

            // Start recording on the second hotkey — first should exit recording
            await config.hotkeyBindButton(secondHotkey).click()
            await expect(config.hotkeyField(secondHotkey)).toContainText('按下快捷键')
            await expect(config.hotkeyField(firstHotkey)).toContainText('未设置')

            // Confirm the second hotkey
            await config.hotkeyField(secondHotkey).press('Control+Alt+Shift+F8')
            await config.hotkeyConfirmButton(secondHotkey).click()
            await expect(config.hotkeyStatus(secondHotkey)).not.toBeVisible()
            await expect_config(omni, secondHotkey, 'CommandOrControl+Shift+Alt+F8')
        } finally {
            await omni.stop()
        }
    })

    test('Shift+digit hotkey displays the digit, not the shifted symbol', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })
        const hotkey = 'hotkey_translate'

        try {
            const config = await omni.openConfig()
            await config.openSection('hotkey')

            // Enter capture mode and press Ctrl+Shift+6
            await config.hotkeyBindButton(hotkey).click()
            await config.hotkeyField(hotkey).press('Control+Shift+6')

            // Before confirm: field must show digit "6", not shifted symbol "^"
            await expect(config.hotkeyField(hotkey)).toContainText('6')
            await expect(config.hotkeyField(hotkey)).not.toContainText('^')

            // Cancel to avoid system registration issues in CI
            await config.hotkeyCancelButton(hotkey).click()
        } finally {
            await omni.stop()
        }
    })

    test('settings window sidebar and content padding match design spec', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()

            // Design spec: sidebar width 132px
            const sidebar = config.window().locator('[data-testid="config-sidebar"]')
            await expect(sidebar).toBeVisible()
            await expect(sidebar).toHaveCSS('width', '132px')

            // Design spec: content area padding 12px 16px 16px
            const content = config.window().locator('[data-testid="config-content"]')
            await expect(content).toBeVisible()
            await expect(content).toHaveCSS('padding-top', '12px')
            await expect(content).toHaveCSS('padding-right', '16px')
            await expect(content).toHaveCSS('padding-bottom', '16px')
            await expect(content).toHaveCSS('padding-left', '16px')
        } finally {
            await omni.stop()
        }
    })

    test('about page shows hero + action tiles layout matching design spec', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()
            await config.openSection('about')

            // Hero card visible
            await expect(config.aboutHero()).toBeVisible()
            await expect(config.aboutHeroLogo()).toContainText('op')
            await expect(config.aboutHeroName()).toContainText('Omni Pot')
            await expect(config.aboutHeroVersion()).toBeVisible()
            await expect(config.aboutHeroDescription()).toBeVisible()

            // Action tiles grid visible with 6 tiles
            await expect(config.aboutGrid()).toBeVisible()
            const tileKeys = await config.aboutTileKeys()
            expect(tileKeys).toEqual(expect.arrayContaining([
                'update', 'home', 'docs', 'feedback', 'support', 'license',
            ]))
            expect(tileKeys).toHaveLength(6)

            // Each tile visible
            await expect(config.aboutTile('update')).toBeVisible()
            await expect(config.aboutTile('home')).toBeVisible()
            await expect(config.aboutTile('docs')).toBeVisible()
            await expect(config.aboutTile('feedback')).toBeVisible()
            await expect(config.aboutTile('support')).toBeVisible()
            await expect(config.aboutTile('license')).toBeVisible()

            // Tile labels
            await expect(config.aboutTile('update')).toContainText('检查更新')
            await expect(config.aboutTile('home')).toContainText('官网')
            await expect(config.aboutTile('docs')).toContainText('文档与帮助')
            await expect(config.aboutTile('feedback')).toContainText('反馈与联系')
            await expect(config.aboutTile('support')).toContainText('支持作者')
            await expect(config.aboutTile('license')).toContainText('开源许可')

            // External tiles have arrow indicator
            await expect(config.aboutTile('home').locator('[data-testid="tile-arrow"]')).toBeVisible()
            await expect(config.aboutTile('docs').locator('[data-testid="tile-arrow"]')).toBeVisible()
            await expect(config.aboutTile('feedback').locator('[data-testid="tile-arrow"]')).toBeVisible()

            // Diagnostics card still visible below
            await expect(config.page.getByTestId('about-config-dir')).toBeVisible()
            await expect(config.page.getByTestId('about-log-dir')).toBeVisible()
            await expect(config.page.getByTestId('about-api-url')).toBeVisible()
            await expect(config.page.getByTestId('about-export-log')).toBeVisible()

            // Hero links: privacy + terms
            await expect(config.aboutHero().getByTestId('about-link-privacy')).toBeVisible()
            await expect(config.aboutHero().getByTestId('about-link-terms')).toBeVisible()

            // Copyright text
            await expect(config.aboutHero().getByTestId('about-copyright')).toContainText('Omni Pot')
        } finally {
            await omni.stop()
        }
    })

    test('about page tile actions open correct URLs', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()
            await config.openSection('about')

            await omni.api.resetShellOpenExternal()

            // 官网 tile
            await config.aboutTile('home').click()
            await expect.poll(async () => (await omni.api.shellOpenExternal()).urls)
                .toContain('https://github.com/TuTouPower/omni_pot')

            await omni.api.resetShellOpenExternal()

            // 文档与帮助 tile
            await config.aboutTile('docs').click()
            await expect.poll(async () => (await omni.api.shellOpenExternal()).urls)
                .toContain('https://github.com/TuTouPower/omni_pot/tree/master/docs')

            await omni.api.resetShellOpenExternal()

            // 反馈与联系 tile
            await config.aboutTile('feedback').click()
            await expect.poll(async () => (await omni.api.shellOpenExternal()).urls)
                .toContain('https://wj.qq.com/edit?sid=27007386')

            await omni.api.resetShellOpenExternal()

            // 检查更新 tile
            await config.aboutTile('update').click()
            await expect.poll(async () => (await omni.api.shellOpenExternal()).urls)
                .toContain('https://github.com/TuTouPower/omni_pot/releases')

            await omni.api.resetShellOpenExternal()

            // 支持作者 tile
            await config.aboutTile('support').click()
            await expect.poll(async () => (await omni.api.shellOpenExternal()).urls)
                .toContain('https://afdian.com/a/tutoupower')

            await omni.api.resetShellOpenExternal()

            // 开源许可 tile
            await config.aboutTile('license').click()
            await expect.poll(async () => (await omni.api.shellOpenExternal()).urls)
                .toContain('https://github.com/TuTouPower/omni_pot/blob/master/LICENSE')
        } finally {
            await omni.stop()
        }
    })

    test('about page text is i18n-aware (English locale)', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'en' } })

        try {
            const config = await omni.openConfig()
            await config.openSection('about')

            // Hero section in English
            await expect(config.aboutHeroName()).toContainText('Omni Pot')
            await expect(config.aboutHeroDescription()).toContainText(/desktop translation/i)

            // Tile labels in English
            await expect(config.aboutTile('update')).toContainText('Check for updates')
            await expect(config.aboutTile('home')).toContainText('Home')
            await expect(config.aboutTile('docs')).toContainText('Docs & Help')
            await expect(config.aboutTile('feedback')).toContainText('Feedback')
            await expect(config.aboutTile('support')).toContainText('Support')
            await expect(config.aboutTile('license')).toContainText('License')

            // Hero links and copyright in English
            await expect(config.aboutHero().getByTestId('about-link-privacy')).toContainText('Privacy')
            await expect(config.aboutHero().getByTestId('about-link-terms')).toContainText('Terms')
        } finally {
            await omni.stop()
        }
    })

    test('about page privacy and terms links are clickable', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()
            await config.openSection('about')

            await omni.api.resetShellOpenExternal()
            await config.aboutHero().getByTestId('about-link-privacy').click()
            await expect.poll(async () => (await omni.api.shellOpenExternal()).urls.length).toBeGreaterThan(0)

            await omni.api.resetShellOpenExternal()
            await config.aboutHero().getByTestId('about-link-terms').click()
            await expect.poll(async () => (await omni.api.shellOpenExternal()).urls.length).toBeGreaterThan(0)
        } finally {
            await omni.stop()
        }
    })
})
