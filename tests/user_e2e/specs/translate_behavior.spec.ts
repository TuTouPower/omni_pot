import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import { TranslationTestServer } from '../fixtures/translation_test_server'

const WINDOW_SIZE_TOLERANCE = 8

const MYMEMORY_INSTANCE = {
    serviceKey: 'mymemory',
    config: {},
}

function mymemory_config(config: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        app_language: 'zh_cn',
        dynamic_translate: false,
        translate_detect_engine: 'local',
        translate_source_language: 'en',
        translate_target_language: 'zh_cn',
        translate_service_list: ['mymemory@default'],
        service_instances: { 'mymemory@default': MYMEMORY_INSTANCE },
        ...config,
    }
}

function no_service_config(config: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        app_language: 'zh_cn',
        dynamic_translate: false,
        translate_detect_engine: 'local',
        translate_service_list: [],
        ...config,
    }
}

async function expect_config(omni: AppFixture, key: string, value: unknown): Promise<void> {
    await expect.poll(async () => (await omni.api.getConfig())[key]).toEqual(value)
}

async function expect_clipboard(omni: AppFixture, text: string): Promise<void> {
    await expect.poll(async () => {
        const clipboard = await omni.api.readClipboard()
        return clipboard.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    }).toBe(text)
}

test.describe('@ui translate behavior settings', () => {
    test('user sees always-on-top state and blur-close behavior follow config', async () => {
        const pinned_app = await AppFixture.start({
            config: no_service_config({
                translate_always_on_top: true,
            }),
        })

        try {
            const translate = await pinned_app.translate()

            await expect.poll(async () => (await pinned_app.api.windowState('translate')).alwaysOnTop).toBe(true)
            await expect(translate.pinButton()).toHaveAttribute('aria-pressed', 'true')
            await expect(translate.topmostButton()).toHaveAttribute('aria-pressed', 'true')

            await translate.clickTopmost()
            await expect.poll(async () => (await pinned_app.api.windowState('translate')).alwaysOnTop).toBe(false)
            await expect_config(pinned_app, 'translate_always_on_top', false)

            const pinned_config = await pinned_app.openConfig()
            await pinned_config.wordmark().click()
            await expect.poll(async () => (await pinned_app.api.windowState('translate')).visible).toBe(true)
        } finally {
            await pinned_app.stop()
        }

        // Unpinned translate window auto-closes on blur (always-on behavior)
        const blur_app = await AppFixture.start({
            config: no_service_config({}),
        })

        try {
            await expect((await blur_app.translate()).wordmark()).toBeVisible()

            const close_config = await blur_app.openConfig()
            await close_config.wordmark().click()
            await expect.poll(async () => (await blur_app.api.windowState('translate')).exists).toBe(false)
        } finally {
            await blur_app.stop()
        }
    })

    test('user can force source input open while hidden-source mode hides task-triggered text', async () => {
        const omni = await AppFixture.start({
            config: no_service_config({
                hide_source: true,
                hide_language: true,
            }),
        })

        try {
            const translate = await omni.translate()
            await expect(translate.sourceInput()).toHaveCount(0)
            await expect(translate.sourceLanguage()).toHaveCount(0)
            await expect(translate.targetLanguage()).toHaveCount(0)

            await omni.triggerInputTranslate()
            await expect(translate.sourceInput()).toBeVisible()
            await expect(translate.sourceInput()).toBeFocused()
            await expect(translate.sourceLanguage()).toHaveCount(0)

            const selection_result = await omni.api.triggerSelection('selection text')
            expect(selection_result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveCount(0)

            await omni.triggerInputTranslate()
            await expect(translate.sourceInput()).toBeVisible()
            const api_result = await omni.api.translateViaHttp('api text')
            expect(api_result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveCount(0)

            await omni.triggerInputTranslate()
            await expect(translate.sourceInput()).toBeVisible()
            const clipboard_result = await omni.api.triggerClipboardTranslate('clipboard text')
            expect(clipboard_result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveCount(0)
        } finally {
            await omni.stop()
        }
    })

    test('input translate hotkey opens source input instead of hiding the visible translate window', async () => {
        const omni = await AppFixture.start({
            config: no_service_config({
                hide_source: true,
                hide_language: true,
                hotkey_input_translate: 'CommandOrControl+Shift+Alt+F9',
            }),
        })

        try {
            const translate = await omni.translate()
            await expect(translate.wordmark()).toBeVisible()
            await expect(translate.sourceInput()).toHaveCount(0)
            await expect.poll(async () => (await omni.api.windowState('translate')).visible).toBe(true)

            const result = await omni.api.triggerHotkey('hotkey_input_translate', 'selected text should be ignored')
            expect(result.success).toBe(true)

            await expect.poll(async () => (await omni.api.windowState('translate')).visible).toBe(true)
            await expect(translate.sourceInput()).toBeVisible()
            await expect(translate.sourceInput()).toBeFocused()
            await expect(translate.sourceInput()).toHaveValue('')
        } finally {
            await omni.stop()
        }
    })

    test('input translate hotkey opens source input after the translate window was closed', async () => {
        const omni = await AppFixture.start({
            config: no_service_config({
                hide_source: true,
                hide_language: true,
                hotkey_input_translate: 'CommandOrControl+Shift+Alt+F9',
            }),
        })

        try {
            const translate = await omni.translate()
            await expect(translate.wordmark()).toBeVisible()
            await translate.clickClose()
            await expect.poll(async () => (await omni.api.windowState('translate')).exists).toBe(false)

            const result = await omni.api.triggerHotkey('hotkey_input_translate')
            expect(result.success).toBe(true)

            const reopened = await omni.translate()
            await expect(reopened.sourceInput()).toBeVisible()
            await expect(reopened.sourceInput()).toBeFocused()
        } finally {
            await omni.stop()
        }
    })

    test('selection hotkeys handle empty selection for translate and dictionary actions', async () => {
        const omni = await AppFixture.start({
            config: no_service_config({
                hotkey_selection_translate: 'CommandOrControl+Shift+Alt+F8',
                hotkey_selection_dictionary: 'CommandOrControl+Shift+Alt+F7',
            }),
        })

        try {
            const translate_result = await omni.api.triggerHotkey('hotkey_selection_translate', '')
            expect(translate_result.success).toBe(true)
            const translate = await omni.translate()
            await expect(translate.sourceInput()).toBeVisible()
            await expect(translate.sourceInput()).toBeFocused()

            const dict_result = await omni.api.triggerHotkey('hotkey_selection_dictionary', '')
            expect(dict_result.success).toBe(true)
            const dict = await omni.dict()
            await expect(dict.selectionEmptyNotice()).toContainText('未读取到选中的文本')
        } finally {
            await omni.stop()
        }
    })

    test('selection hotkeys use selected text for translate and dictionary actions', async () => {
        const omni = await AppFixture.start({
            config: no_service_config({
                dictionary_service_list: [],
                hotkey_selection_translate: 'CommandOrControl+Shift+Alt+F8',
                hotkey_selection_dictionary: 'CommandOrControl+Shift+Alt+F7',
            }),
        })

        try {
            const translate_result = await omni.api.triggerHotkey('hotkey_selection_translate', 'selected translate text')
            expect(translate_result.success).toBe(true)
            const translate = await omni.translate()
            await expect(translate.sourceInput()).toHaveValue('selected translate text')

            const dict_result = await omni.api.triggerHotkey('hotkey_selection_dictionary', 'selected')
            expect(dict_result.success).toBe(true)
            const dict = await omni.dict()
            await expect(dict.word()).toContainText('selected')
        } finally {
            await omni.stop()
        }
    })

    test('user-triggered translation replaces text and normalizes newlines when incremental mode is off', async () => {
        const omni = await AppFixture.start({
            config: no_service_config({ translate_delete_newline: true }),
        })

        try {
            const translate = await omni.translate()

            const first_result = await omni.api.triggerSelection('  hello-\nworld  ')
            expect(first_result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue('helloworld')

            const second_result = await omni.api.triggerClipboardTranslate('  replacement\ntext  ')
            expect(second_result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue('replacement text')
        } finally {
            await omni.stop()
        }
    })

    test('user-triggered translation appends selection, clipboard, and API text when incremental mode is on', async () => {
        const omni = await AppFixture.start({
            config: no_service_config({
                incremental_translate: true,
                translate_delete_newline: true,
            }),
        })

        try {
            const translate = await omni.translate()

            const selection_result = await omni.api.triggerSelection('  first  ')
            expect(selection_result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue('first')

            const clipboard_result = await omni.api.triggerClipboardTranslate('  second-\nline  ')
            expect(clipboard_result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue('first secondline')

            const api_result = await omni.api.translateViaHttp('  third\nline  ')
            expect(api_result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue('first secondline third line')
        } finally {
            await omni.stop()
        }
    })

    for (const { mode, expected_clipboard } of [
        { mode: 'source', expected_clipboard: 'copy source text' },
        { mode: 'target', expected_clipboard: '复制目标译文' },
        { mode: 'source_target', expected_clipboard: 'copy source text\n\n复制目标译文' },
        { mode: 'disable', expected_clipboard: 'previous clipboard' },
    ] as const) {
        test(`user sees translate_auto_copy=${mode} update clipboard correctly`, async () => {
            const omni = await AppFixture.start({
                config: { app_language: 'zh_cn', translate_auto_copy: mode, translate_detect_engine: 'local', translate_source_language: 'en', translate_target_language: 'zh_cn' },
            })
            let server: TranslationTestServer | null = null

            try {
                server = await omni.startTranslationTestServer()
                server.set_mymemory_response({ translated_text: '复制目标译文', status: 200 })

                const translate = await omni.translate()
                await omni.api.triggerClipboard('previous clipboard')

                await translate.typeSource('copy source text')
                await translate.clickTranslate()

                await expect(translate.resultBody('mymemory@e2e')).toContainText('复制目标译文')
                await expect_clipboard(omni, expected_clipboard)
            } finally {
                await server?.stop()
                await omni.stop()
            }
        })
    }

    test('user stops typing and dynamic translate shows a result without clicking translate', async () => {
        const omni = await AppFixture.start({
            config: { app_language: 'zh_cn', dynamic_translate: true, translate_detect_engine: 'local', translate_source_language: 'en', translate_target_language: 'zh_cn' },
        })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            server.set_mymemory_response({ translated_text: '动态翻译结果', status: 200 })

            const translate = await omni.translate()

            await translate.typeSource('dynamic source text')

            await expect(translate.resultBody('mymemory@e2e')).toContainText('动态翻译结果', { timeout: 15_000 })

            // Verify debounce: should have sent exactly 1 request after typing stopped
            expect(server.request_count).toBe(1)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('changing language with source text retranslates immediately', async () => {
        const omni = await AppFixture.start({
            config: { app_language: 'zh_cn', translate_detect_engine: 'local', translate_source_language: 'en', translate_target_language: 'zh_cn' },
        })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            server.set_mymemory_response({ translated_text: '初始译文', status: 200 })

            const translate = await omni.translate()
            await translate.typeSource('language switch text')
            await translate.clickTranslate()
            await expect(translate.resultBody('mymemory@e2e')).toContainText('初始译文')

            // Change response for the retranslation after language switch
            server.set_mymemory_response({ translated_text: '日语译文', status: 200 })
            server.clear_requests()

            await translate.selectTargetLanguage('ja')
            await expect(translate.resultBody('mymemory@e2e')).toContainText('日语译文')

            // Verify retranslation actually sent a new request
            expect(server.request_count).toBeGreaterThanOrEqual(1)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('user gets the configured second language when detected language equals target language', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                translate_detect_engine: 'local',
                translate_source_language: 'auto',
                translate_target_language: 'en',
                translate_second_language: 'zh_cn',
            },
        })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            server.set_mymemory_response({ translated_text: '回退到第二语言', status: 200 })

            const translate = await omni.translate()

            await translate.typeSource('hello fallback target')
            await translate.clickTranslate()

            await expect(translate.detectedLanguage()).toContainText('英文')
            await expect(translate.resultBody('mymemory@e2e')).toContainText('回退到第二语言')
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('user reopens translate window with remembered size and languages', async () => {
        const omni = await AppFixture.start({
            config: no_service_config({
                translate_remember_language: true,
                translate_remember_window_size: true,
            }),
        })

        try {
            const translate = await omni.translate()

            await translate.selectSourceLanguage('en')
            await translate.selectTargetLanguage('ja')
            await expect_config(omni, 'translate_source_language', 'en')
            await expect_config(omni, 'translate_target_language', 'ja')

            await translate.resizeWindowTo(520, 560)
            await expect.poll(async () => {
                const bounds = (await omni.api.windowState('translate')).bounds
                return !!bounds && bounds.width > 500 && bounds.height >= 320 && bounds.height <= 400 + WINDOW_SIZE_TOLERANCE
            }).toBe(true)
            const resized_bounds = (await omni.api.windowState('translate')).bounds
            if (!resized_bounds) throw new Error('Translate window bounds unavailable')
            const expected_width = resized_bounds.width
            const expected_height = resized_bounds.height
            await expect_config(omni, 'translate_window_width', expected_width)
            await expect_config(omni, 'translate_window_height', expected_height)

            await translate.clickClose()
            await expect.poll(async () => (await omni.api.windowState('translate')).exists).toBe(false)

            const open_result = await omni.api.openWindow('translate')
            expect(open_result.success).toBe(true)
            const reopened = await omni.translate()
            await reopened.dismissWelcome()

            await expect(reopened.sourceLanguage()).toContainText('英文')
            await expect(reopened.targetLanguage()).toContainText('日语')
            await expect.poll(async () => {
                const bounds = (await omni.api.windowState('translate')).bounds
                return !!bounds
                    && Math.abs(bounds.width - expected_width) <= WINDOW_SIZE_TOLERANCE
                    && Math.abs(bounds.height - expected_height) <= WINDOW_SIZE_TOLERANCE
            }).toBe(true)
        } finally {
            await omni.stop()
        }
    })
})
