import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

test.describe('@ui translate language area', () => {
    test('user sees localized language labels and reverses detected direction', async ({ omni }) => {
        const translate = await omni.translate()
        const result = await omni.api.triggerSelection('hello world')

        expect(result.success).toBe(true)
        await expect(translate.sourceInput()).toHaveValue('hello world', { timeout: 10_000 })
        await expect(translate.sourceLanguage()).toContainText('自动检测')
        await expect(translate.sourceLanguage()).not.toContainText('auto')
        await expect(translate.targetLanguage()).toContainText('简体中文')
        await expect(translate.targetLanguage()).not.toContainText('zh_cn')
        await expect(translate.detectedLanguage()).toContainText('检测为 英文', { timeout: 15_000 })
        await expect(translate.detectedLanguage()).not.toContainText('en')

        await translate.clickSwap()
        await expect(translate.sourceLanguage()).toContainText('简体中文')
        await expect(translate.targetLanguage()).toContainText('英文')
        await expect(translate.detectedLanguage()).toHaveCount(0)
    })

    test('user clicks detected language to reverse direction', async ({ omni }) => {
        const translate = await omni.translate()
        const result = await omni.api.triggerSelection('hello world')

        expect(result.success).toBe(true)
        await expect(translate.detectedLanguage()).toContainText('检测为 英文', { timeout: 15_000 })

        await translate.clickDetectedLanguage()
        await expect(translate.sourceLanguage()).toContainText('简体中文')
        await expect(translate.targetLanguage()).toContainText('英文')
        await expect(translate.detectedLanguage()).toHaveCount(0)
    })

    test('user reverses to fallback target when detected language matches configured target', async () => {
        const omni = await AppFixture.start({ config: { translate_target_language: 'en', translate_second_language: 'zh_cn' } })
        try {
            const translate = await omni.translate()
            const result = await omni.api.triggerSelection('hello world')

            expect(result.success).toBe(true)
            await expect(translate.targetLanguage()).toContainText('英文')
            await expect(translate.detectedLanguage()).toContainText('检测为 英文', { timeout: 15_000 })

            await translate.clickDetectedLanguage()
            await expect(translate.sourceLanguage()).toContainText('简体中文')
            await expect(translate.targetLanguage()).toContainText('英文')
            await expect(translate.detectedLanguage()).toHaveCount(0)
        } finally {
            await omni.stop()
        }
    })
})
