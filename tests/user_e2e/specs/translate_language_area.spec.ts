import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import type { TranslatePage } from '../pages/translate_page'

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
        translate_detect_engine: 'local',
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
            await expect(translate.detectedLanguage()).toContainText('检测为 英文', { timeout: 15_000 })

            await translate.clickDetectedLanguage()
            await expect(translate.sourceLanguage()).toContainText('简体中文')
            await expect(translate.targetLanguage()).toContainText('英文')
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

    test('user changes languages and retranslates with the new direction', async () => {
        const omni = await AppFixture.start({
            config: language_area_config({
                translate_service_list: ['lingva@default'],
                service_instances: {
                    'lingva@default': { serviceKey: 'lingva', config: { requestPath: 'https://lingva.lunar.icu' } },
                },
            }),
        })

        try {
            const translate = await omni.translate()

            await translate.selectSourceLanguage('en')
            await expect(translate.sourceLanguage()).toContainText('英文')
            await translate.typeSource('hello world')
            await translate.clickTranslate()
            await expect.poll(async () => first_visible_result_text(translate), { timeout: 45_000 }).not.toBe('')
            const chinese_result = await first_visible_result_text(translate)

            await translate.selectTargetLanguage('ja')
            await expect(translate.targetLanguage()).toContainText('日语')
            await translate.clickTranslate()
            await expect.poll(async () => {
                const text = await first_visible_result_text(translate)
                return text && text !== chinese_result ? text : ''
            }, { timeout: 45_000 }).not.toBe('')
        } finally {
            await omni.stop()
        }
    })
})
