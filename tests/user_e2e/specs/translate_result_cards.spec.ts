import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const lingva_config = {
    app_language: 'zh_cn',
    dynamic_translate: false,
    translate_detect_engine: 'local',
    translate_source_language: 'en',
    translate_target_language: 'zh_cn',
    translate_service_list: ['lingva@default'],
    tts_service_list: ['lingva_tts@default'],
    collection_service_list: ['anki@default'],
    service_instances: {
        'lingva@default': { serviceKey: 'lingva', config: { requestPath: 'https://lingva.lunar.icu' } },
        'lingva_tts@default': { serviceKey: 'lingva_tts', config: { requestPath: 'https://lingva.lunar.icu' } },
        'anki@default': { serviceKey: 'anki', config: { port: 8765 } },
    },
}

test.describe('@ui translate result cards', () => {
    test('cards stay collapsed while translating and auto-expand when the result arrives', async () => {
        const omni = await AppFixture.start({ config: lingva_config })

        try {
            const translate = await omni.translate()
            const pending = await translate.hold_lingva_translation_once('你好世界')

            await translate.typeSource('hello world')
            await translate.clickTranslate()
            await pending.wait_for_request()

            // While in-flight: the card exists, but its body content is collapsed
            // (loading indicator visible, translated body absent).
            await expect(translate.resultCard('lingva@default')).toBeVisible()
            await expect(translate.resultCard('lingva@default').getByTestId('result-loading')).toBeVisible()
            await expect(translate.resultBody('lingva@default')).toHaveCount(0)
            await expect(translate.resultAction('lingva@default', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'false')

            // Release the response. The card must auto-expand without user clicks.
            await pending.release_response()
            await expect(translate.resultBody('lingva@default')).toContainText('你好世界')
            await expect(translate.resultAction('lingva@default', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'true')
        } finally {
            await omni.stop()
        }
    })

    test('user copies, collects, collapses, expands, and retries a result card', async () => {
        const omni = await AppFixture.start({ config: lingva_config })

        try {
            const translate = await omni.translate()

            await translate.fail_then_succeed_lingva_translation_once('你好世界')
            await translate.typeSource('hello world')
            await translate.clickTranslate()

            await expect(translate.resultError('lingva@default')).toContainText('翻译失败')
            await expect(translate.resultRetryButton('lingva@default')).toBeVisible()

            await translate.clickResultRetry('lingva@default')
            await expect(translate.resultBody('lingva@default')).toContainText('你好世界')
            await expect(translate.resultRetryButton('lingva@default')).toHaveCount(0)

            await translate.clickResultCopy('lingva@default')
            await expect.poll(async () => (await omni.api.readClipboard()).text).toBe('你好世界')

            await translate.fulfill_anki_collection_once()
            await translate.clickResultCollect('lingva@default')
            await expect(translate.resultAction('lingva@default', 'result-collect')).toHaveAttribute('aria-pressed', 'true')

            await translate.clickResultCollapse('lingva@default')
            await expect(translate.resultBody('lingva@default')).toHaveCount(0)
            await expect(translate.resultAction('lingva@default', 'result-collapse')).toHaveAttribute('aria-expanded', 'false')

            await translate.clickResultCollapse('lingva@default')
            await expect(translate.resultBody('lingva@default')).toContainText('你好世界')
            await expect(translate.resultAction('lingva@default', 'result-collapse')).toHaveAttribute('aria-expanded', 'true')
        } finally {
            await omni.stop()
        }
    })

    test('user sees translating animation without implementation stream label while waiting', async () => {
        const omni = await AppFixture.start({ config: lingva_config })

        try {
            const translate = await omni.translate()
            const pending_translation = await translate.hold_lingva_translation_once('你好世界')

            await translate.typeSource('hello world')
            await translate.clickTranslate()
            await pending_translation.wait_for_request()

            await expect(translate.resultCard('lingva@default').getByTestId('result-loading')).toContainText('翻译中')
            await expect(translate.resultCard('lingva@default')).not.toContainText('stream')

            await pending_translation.release_response()
            await expect(translate.resultBody('lingva@default')).toContainText('你好世界')
        } finally {
            await omni.stop()
        }
    })

    test('user stops result TTS while audio is still loading', async () => {
        const omni = await AppFixture.start({ config: lingva_config })

        try {
            const translate = await omni.translate()
            await translate.fulfill_lingva_translation_once('你好世界')
            const tts = await translate.hold_lingva_tts()

            await translate.typeSource('hello world')
            await translate.clickTranslate()
            await expect(translate.resultBody('lingva@default')).toContainText('你好世界')

            await expect(translate.result_tts_button('lingva@default')).toHaveAttribute('aria-pressed', 'false')
            await translate.click_result_tts('lingva@default')
            await tts.wait_for_request()
            await expect(translate.result_tts_button('lingva@default')).toHaveAttribute('aria-pressed', 'true')

            await translate.click_result_tts('lingva@default')
            await expect(translate.result_tts_button('lingva@default')).toHaveAttribute('aria-pressed', 'false')
            await tts.wait_for_request_count(1)
            await tts.release_response()
        } finally {
            await omni.stop()
        }
    })

    test('user drags result cards to persist translation service order', async () => {
        const omni = await AppFixture.start({
            config: {
                translate_service_list: ['bing@default', 'google@default'],
            },
        })

        try {
            const translate = await omni.translate()
            await translate.typeSource('hello')

            await expect(translate.resultCards()).toHaveCount(2)
            await expect(translate.resultCards().nth(0)).toContainText('Bing')
            await expect(translate.resultCards().nth(1)).toContainText('Google')

            await translate.drag_result_card('google@default', 'bing@default')

            await expect(translate.resultCards().nth(0)).toContainText('Google')
            await expect(translate.resultCards().nth(1)).toContainText('Bing')

            const config = await omni.openConfig()
            await config.openSection('service')
            await expect(config.serviceItems().nth(0)).toContainText('Google')
            await expect(config.serviceItems().nth(1)).toContainText('Bing')
        } finally {
            await omni.stop()
        }
    })

    test('user drags result cards with disabled services interleaved and sees full settings order', async () => {
        const omni = await AppFixture.start({
            config: {
                translate_service_list: ['bing@default', 'deepl@default', 'google@default'],
                service_instances: {
                    'bing@default': { serviceKey: 'bing', config: {} },
                    'deepl@default': { serviceKey: 'deepl', config: { enable: false } },
                    'google@default': { serviceKey: 'google', config: {} },
                },
            },
        })

        try {
            const translate = await omni.translate()
            await translate.typeSource('hello')

            await expect(translate.resultCards()).toHaveCount(2)
            await expect(translate.resultCards().nth(0)).toContainText('Bing')
            await expect(translate.resultCards().nth(1)).toContainText('Google')

            await translate.drag_result_card('google@default', 'bing@default')

            await expect(translate.resultCards().nth(0)).toContainText('Google')
            await expect(translate.resultCards().nth(1)).toContainText('Bing')
            const config = await omni.openConfig()
            await config.openSection('service')
            await expect(config.serviceItems().nth(0)).toContainText('Google')
            await expect(config.serviceItems().nth(1)).toContainText('DeepL')
            await expect(config.serviceItems().nth(2)).toContainText('Bing')

            await config.clickClose()
            await translate.drag_result_card('bing@default', 'google@default')

            await expect(translate.resultCards().nth(0)).toContainText('Bing')
            await expect(translate.resultCards().nth(1)).toContainText('Google')
            const config_after_reverse = await omni.openConfig()
            await config_after_reverse.openSection('service')
            await expect(config_after_reverse.serviceItems().nth(0)).toContainText('Bing')
            await expect(config_after_reverse.serviceItems().nth(1)).toContainText('DeepL')
            await expect(config_after_reverse.serviceItems().nth(2)).toContainText('Google')
        } finally {
            await omni.stop()
        }
    })

    test.describe('network dictionary result cards', () => {
        test.describe.configure({ retries: 2 })

        test('dictionary result cards render pronunciation, definitions, and examples', async () => {
            const omni = await AppFixture.start({
                config: {
                    dynamic_translate: false,
                    translate_service_list: ['free_dictionary@default'],
                    service_instances: {
                        'free_dictionary@default': { serviceKey: 'free_dictionary', config: {} },
                    },
                },
            })

            try {
                const translate = await omni.translate()

                await translate.typeSource('hello')
                await translate.clickTranslate()

                await expect(translate.resultCard('free_dictionary@default')).toBeVisible()
                await expect(translate.resultBody('free_dictionary@default')).toContainText('noun', { timeout: 45_000 })
                await expect(translate.resultBody('free_dictionary@default')).toContainText('greeting', { timeout: 45_000 })
            } finally {
                await omni.stop()
            }
        })
    })
})
