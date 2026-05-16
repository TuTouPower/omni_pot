import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const WINDOW_SIZE_TOLERANCE = 8

const LINGVA_INSTANCE = {
    serviceKey: 'lingva',
    config: { requestPath: 'https://lingva.lunar.icu' },
}

function lingva_config(config: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        app_language: 'zh_cn',
        dynamic_translate: false,
        translate_detect_engine: 'local',
        translate_source_language: 'en',
        translate_target_language: 'zh_cn',
        translate_service_list: ['lingva@default'],
        service_instances: { 'lingva@default': LINGVA_INSTANCE },
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
                translate_close_on_blur: false,
            }),
        })

        try {
            const translate = await pinned_app.translate()

            await expect.poll(async () => (await pinned_app.api.windowState('translate')).alwaysOnTop).toBe(true)
            await expect(translate.pinButton()).toHaveAttribute('aria-pressed', 'true')

            await translate.clickPin()
            await expect.poll(async () => (await pinned_app.api.windowState('translate')).alwaysOnTop).toBe(false)
            await expect_config(pinned_app, 'translate_always_on_top', false)

            const pinned_config = await pinned_app.openConfig()
            await pinned_config.wordmark().click()
            await expect.poll(async () => (await pinned_app.api.windowState('translate')).visible).toBe(true)
        } finally {
            await pinned_app.stop()
        }

        const close_on_blur_app = await AppFixture.start({
            config: no_service_config({ translate_close_on_blur: true }),
        })

        try {
            await expect((await close_on_blur_app.translate()).wordmark()).toBeVisible()

            const close_config = await close_on_blur_app.openConfig()
            await close_config.wordmark().click()
            await expect.poll(async () => (await close_on_blur_app.api.windowState('translate')).exists).toBe(false)
        } finally {
            await close_on_blur_app.stop()
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

            const result = await omni.api.triggerHotkey('hotkey_input_translate')
            expect(result.success).toBe(true)

            await expect.poll(async () => (await omni.api.windowState('translate')).visible).toBe(true)
            await expect(translate.sourceInput()).toBeVisible()
            await expect(translate.sourceInput()).toBeFocused()
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

    test('selection hotkeys show visible feedback when no text is selected', async () => {
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
            await expect(translate.selectionEmptyNotice()).toContainText('未读取到选中的文本')

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
                config: lingva_config({ translate_auto_copy: mode }),
            })

            try {
                const translate = await omni.translate()
                await omni.api.triggerClipboard('previous clipboard')
                await translate.fulfill_lingva_translation_once('复制目标译文')

                await translate.typeSource('copy source text')
                await translate.clickTranslate()

                await expect(translate.resultBody('lingva@default')).toContainText('复制目标译文')
                await expect_clipboard(omni, expected_clipboard)
            } finally {
                await omni.stop()
            }
        })
    }

    test('user stops typing and dynamic translate shows a result without clicking translate', async () => {
        const omni = await AppFixture.start({
            config: lingva_config({ dynamic_translate: true }),
        })

        try {
            const translate = await omni.translate()
            await translate.fulfill_lingva_translation_once('动态翻译结果')

            await translate.typeSource('dynamic source text')

            await expect(translate.resultBody('lingva@default')).toContainText('动态翻译结果', { timeout: 15_000 })
        } finally {
            await omni.stop()
        }
    })

    test('changing language with source text retranslates immediately', async () => {
        const omni = await AppFixture.start({ config: lingva_config() })

        try {
            const translate = await omni.translate()
            await translate.fulfill_lingva_translation_once('初始译文')
            await translate.typeSource('language switch text')
            await translate.clickTranslate()
            await expect(translate.resultBody('lingva@default')).toContainText('初始译文')

            await translate.sourceInput().page().route('https://lingva.lunar.icu/api/v1/*/ja/**', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ translation: '日语译文' }),
                })
            }, { times: 1 })

            await translate.selectTargetLanguage('ja')
            await expect(translate.resultBody('lingva@default')).toContainText('日语译文')
        } finally {
            await omni.stop()
        }
    })

    test('user gets the configured second language when detected language equals target language', async () => {
        const omni = await AppFixture.start({
            config: lingva_config({
                translate_source_language: 'auto',
                translate_target_language: 'en',
                translate_second_language: 'zh_cn',
            }),
        })

        try {
            const translate = await omni.translate()
            await translate.fulfill_lingva_translation_once('回退到第二语言')

            await translate.typeSource('hello fallback target')
            await translate.clickTranslate()

            await expect(translate.detectedLanguage()).toContainText('英文')
            await expect(translate.resultBody('lingva@default')).toContainText('回退到第二语言')
        } finally {
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
                return !!bounds && bounds.width > 350 && bounds.height > 420
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
