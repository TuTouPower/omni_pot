import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import type { TranslationTestServer } from '../fixtures/translation_test_server'
import type { TranslatePage } from '../pages/translate_page'
import { local_operation_timeout_ms, local_translation_timeout_ms, network_translation_timeout_ms } from '../fixtures/timeout_constants'

async function first_visible_result_text(translate: TranslatePage): Promise<string> {
    const bodies = translate.resultBodies()
    for (let i = 0; i < await bodies.count(); i += 1) {
        const text = await bodies.nth(i).textContent()
        if (text?.trim()) return text.trim()
    }
    return ''
}

function language_area_config(config: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        app_language: 'zh_cn',
        dynamic_translate: false,
        translate_service_list: [],
        ...config,
    }
}

test.describe('@ui translate language area', () => {
    test('user sees localized language labels and reverses detected direction', async () => {
        const omni = await AppFixture.start({ config: language_area_config() })
        try {
            const translate = await omni.translate()
            const result = await omni.api.triggerSelection('hello world')

            expect(result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue('hello world', { timeout: local_operation_timeout_ms })
            await expect(translate.sourceLanguage()).toContainText('自动检测')
            await expect(translate.sourceLanguage()).not.toContainText('auto')
            await expect(translate.targetLanguage()).toContainText('简体中文')
            await expect(translate.targetLanguage()).not.toContainText('zh_cn')
            await expect(translate.detectedLanguage()).toContainText('检测为 English', { timeout: local_translation_timeout_ms })
            await expect(translate.detectedLanguage()).not.toContainText('en')

            await translate.clickSwap()
            await expect(translate.sourceLanguage()).toContainText('简体中文')
            await expect(translate.targetLanguage()).toContainText('English')
            await expect(translate.detectedLanguage()).toHaveCount(0)
        } finally {
            await omni.stop()
        }
    })

    test('user clicks detected language to reverse direction', async () => {
        const omni = await AppFixture.start({ config: language_area_config() })
        try {
            const translate = await omni.translate()
            const result = await omni.api.triggerSelection('hello world')

            expect(result.success).toBe(true)
            await expect(translate.detectedLanguage()).toContainText('检测为 English', { timeout: local_translation_timeout_ms })

            await translate.clickDetectedLanguage()
            await expect(translate.sourceLanguage()).toContainText('简体中文')
            await expect(translate.targetLanguage()).toContainText('English')
            await expect(translate.detectedLanguage()).toHaveCount(0)
        } finally {
            await omni.stop()
        }
    })

    test('user reverses to fallback target when detected language matches configured target', async () => {
        const omni = await AppFixture.start({ config: language_area_config({ translate_target_language: 'en', translate_second_language: 'zh_cn' }) })
        try {
            const translate = await omni.translate()
            const result = await omni.api.triggerSelection('hello world')

            expect(result.success).toBe(true)
            await expect(translate.targetLanguage()).toContainText('简体中文')
            await expect(translate.detectedLanguage()).toContainText('检测为 English', { timeout: local_translation_timeout_ms })

            await translate.clickDetectedLanguage()
            await expect(translate.sourceLanguage()).toContainText('简体中文')
            await expect(translate.targetLanguage()).toContainText('English')
            await expect(translate.detectedLanguage()).toHaveCount(0)
        } finally {
            await omni.stop()
        }
    })

    test('user translates detected Chinese text to English fallback with matching UI direction', async () => {
        const omni = await AppFixture.start({
            config: language_area_config({
                translate_target_language: 'zh_cn',
                translate_second_language: 'en',
            }),
        })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            server.set_mymemory_response({ translated_text: 'hello', status: 200 })

            const translate = await omni.translate()
            const result = await omni.api.triggerSelection('你好')

            expect(result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue('你好', { timeout: local_operation_timeout_ms })
            await expect(translate.detectedLanguage()).toContainText('检测为 简体中文', { timeout: local_translation_timeout_ms })
            await expect(translate.targetLanguage()).toContainText('English')
            await expect.poll(async () => first_visible_result_text(translate), { timeout: network_translation_timeout_ms }).toBe('hello')
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('user changes languages and retranslates with the new direction', async () => {
        const omni = await AppFixture.start({
            config: language_area_config(),
        })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            server.set_mymemory_response({ translated_text: '中文译文', status: 200 })

            const translate = await omni.translate()

            await translate.selectSourceLanguage('en')
            await expect(translate.sourceLanguage()).toContainText('English')
            await translate.typeSource('hello world')
            await translate.clickTranslate()
            await expect.poll(async () => first_visible_result_text(translate), { timeout: network_translation_timeout_ms }).not.toBe('')
            const chinese_result = await first_visible_result_text(translate)

            await translate.selectTargetLanguage('ja')
            server.set_mymemory_response({ translated_text: '日本語訳', status: 200 })
            await expect(translate.targetLanguage()).toContainText('日本語')
            await translate.clickTranslate()
            await expect.poll(async () => {
                const text = await first_visible_result_text(translate)
                return text && text !== chinese_result ? text : ''
            }, { timeout: network_translation_timeout_ms }).not.toBe('')
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })
})
