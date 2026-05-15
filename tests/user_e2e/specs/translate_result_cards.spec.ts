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

            await expect.poll(async () => await translate.result_action_order('lingva@default')).toEqual([
                'result-tts',
                'result-copy',
                'result-collect',
                'result-collapse',
            ])

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
            tts.release_response()
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

            await expect(translate.resultCard('bing@default')).toBeVisible()
            await expect(translate.resultCard('google@default')).toBeVisible()
            await expect.poll(async () => await translate.result_card_keys()).toEqual(['bing@default', 'google@default'])

            await translate.drag_result_card('google@default', 'bing@default')

            await expect.poll(async () => await translate.result_card_keys()).toEqual(['google@default', 'bing@default'])
            await expect.poll(async () => {
                const config = await omni.api.getConfig()
                return config.translate_service_list as string[]
            }).toEqual(['google@default', 'bing@default'])
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

            await expect.poll(async () => await translate.result_card_keys()).toEqual(['bing@default', 'google@default'])

            await translate.drag_result_card('google@default', 'bing@default')

            await expect.poll(async () => await translate.result_card_keys()).toEqual(['google@default', 'bing@default'])
            const config = await omni.openConfig()
            await config.openSection('service')
            await expect.poll(async () => await config.serviceItemKeys()).toEqual(['google@default', 'deepl@default', 'bing@default'])
            await expect.poll(async () => {
                const app_config = await omni.api.getConfig()
                return app_config.translate_service_list as string[]
            }).toEqual(['google@default', 'deepl@default', 'bing@default'])

            await config.clickClose()
            await translate.drag_result_card('bing@default', 'google@default')

            await expect.poll(async () => await translate.result_card_keys()).toEqual(['bing@default', 'google@default'])
            const config_after_reverse = await omni.openConfig()
            await config_after_reverse.openSection('service')
            await expect.poll(async () => await config_after_reverse.serviceItemKeys()).toEqual(['bing@default', 'deepl@default', 'google@default'])
            await expect.poll(async () => {
                const app_config = await omni.api.getConfig()
                return app_config.translate_service_list as string[]
            }).toEqual(['bing@default', 'deepl@default', 'google@default'])
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
