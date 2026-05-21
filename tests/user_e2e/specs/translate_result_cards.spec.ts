import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import type { TranslationTestServer } from '../fixtures/translation_test_server'

const test_service_config = {
    app_language: 'zh_cn',
    dynamic_translate: false,
    translate_source_language: 'en',
    translate_target_language: 'zh_cn',
    tts_service_list: ['system_tts@default'],
    collection_service_list: ['anki@default'],
    service_instances: {
        'system_tts@default': { serviceKey: 'system_tts', config: {} },
        'anki@default': { serviceKey: 'anki', config: { port: 8765 } },
    },
}

test.describe('@ui translate result cards', () => {
    test('cards stay collapsed while translating and auto-expand when the result arrives (stubbed - local HTTP server)', async () => {
        const omni = await AppFixture.start({ config: test_service_config })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()
            server.set_mymemory_response({ translated_text: '你好世界', status: 200, delay_ms: 2000 })

            await translate.typeSource('hello world')
            await translate.clickTranslate()

            await expect(translate.resultCard('mymemory@e2e')).toBeVisible({ timeout: 15_000 })
            await expect(translate.resultCard('mymemory@e2e').getByTestId('result-loading')).toBeVisible()
            await expect(translate.resultBody('mymemory@e2e')).toHaveCount(0)
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'false')

            await expect(translate.resultBody('mymemory@e2e')).toContainText('你好世界', { timeout: 15_000 })
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'true')
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('user copies, collects, collapses, expands, and retries a result card (stubbed - local HTTP server)', async () => {
        const omni = await AppFixture.start({ config: test_service_config })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            server.set_mymemory_response({ translated_text: '', status: 500 })
            await translate.typeSource('hello world')
            await translate.clickTranslate()

            await expect(translate.resultError('mymemory@e2e')).toContainText('翻译失败', { timeout: 30_000 })
            await expect(translate.resultRetryButton('mymemory@e2e')).toBeVisible()

            server.set_mymemory_response({ translated_text: '你好世界', status: 200 })
            await translate.clickResultRetry('mymemory@e2e')
            await expect(translate.resultBody('mymemory@e2e')).toContainText('你好世界', { timeout: 30_000 })
            await expect(translate.resultRetryButton('mymemory@e2e')).toHaveCount(0)

            await translate.clickResultCopy('mymemory@e2e')
            await expect.poll(async () => (await omni.api.readClipboard()).text).toBe('你好世界')

            await translate.fulfill_anki_collection_once()
            await translate.clickResultCollect('mymemory@e2e')
            await expect(translate.resultAction('mymemory@e2e', 'result-collect')).toHaveAttribute('aria-pressed', 'true')

            await translate.clickResultCollapse('mymemory@e2e')
            await expect(translate.resultBody('mymemory@e2e')).toHaveCount(0)
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse')).toHaveAttribute('aria-expanded', 'false')

            await translate.clickResultCollapse('mymemory@e2e')
            await expect(translate.resultBody('mymemory@e2e')).toContainText('你好世界')
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse')).toHaveAttribute('aria-expanded', 'true')
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('user sees translating animation without implementation stream label while waiting', async () => {
        const omni = await AppFixture.start({ config: test_service_config })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            server.set_mymemory_response({ translated_text: '你好世界', status: 200, delay_ms: 2000 })

            const translate = await omni.translate()
            await translate.typeSource('hello world')
            await translate.clickTranslate()

            await expect(translate.resultCard('mymemory@e2e')).toBeVisible({ timeout: 15_000 })
            await expect(translate.resultCard('mymemory@e2e').getByTestId('result-loading')).toContainText('翻译中')
            await expect(translate.resultCard('mymemory@e2e')).not.toContainText('stream')

            await expect(translate.resultBody('mymemory@e2e')).toContainText('你好世界', { timeout: 15_000 })
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('user stops result TTS while audio is still loading', async () => {
        const omni = await AppFixture.start({
            init_script: `
                const fake_voice = { lang: 'zh-CN', name: 'Fake-zh', default: true, localService: true, voiceURI: 'fake' };
                window.__last_utterance = null;
                window.__keep_speaking = true;
                Object.defineProperty(window, 'speechSynthesis', {
                    configurable: true,
                    value: {
                        speaking: false, paused: false, pending: false,
                        getVoices: () => [fake_voice],
                        speak: (u) => { window.__last_utterance = u; if (!window.__keep_speaking) setTimeout(() => u.onend && u.onend(new Event('end')), 30) },
                        cancel: () => { const u = window.__last_utterance; if (u && u.onend) u.onend(new Event('end')) },
                        addEventListener: () => {},
                        removeEventListener: () => {},
                    },
                });
            `,
        })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            server.set_mymemory_response({ translated_text: '你好世界', status: 200 })

            const translate = await omni.translate()
            await translate.typeSource('hello world')
            await translate.clickTranslate()
            await expect(translate.resultBody('mymemory@e2e')).toContainText('你好世界')

            await expect(translate.result_tts_button('mymemory@e2e')).toHaveAttribute('aria-pressed', 'false')
            await translate.click_result_tts('mymemory@e2e')
            await expect(translate.result_tts_button('mymemory@e2e')).toHaveAttribute('aria-pressed', 'true')

            await translate.click_result_tts('mymemory@e2e')
            await expect(translate.result_tts_button('mymemory@e2e')).toHaveAttribute('aria-pressed', 'false')
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('manual collapse persists until a new translation request resets cards', async () => {
        const omni = await AppFixture.start({ config: test_service_config })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            server.set_mymemory_response({ translated_text: '第一轮结果', status: 200 })
            await translate.typeSource('first request')
            await translate.clickTranslate()
            await expect(translate.resultBody('mymemory@e2e')).toContainText('第一轮结果', { timeout: 15_000 })

            // Spec §5.4: 用户手动折叠后保持状态。
            await translate.clickResultCollapse('mymemory@e2e')
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'false')

            // A second translation request should reset the collapse state.
            server.set_mymemory_response({ translated_text: '第二轮结果', status: 200 })
            await translate.typeSource('second request')
            await translate.clickTranslate()
            await expect(translate.resultBody('mymemory@e2e')).toContainText('第二轮结果', { timeout: 15_000 })
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'true')
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('retry only re-triggers the specific failed service, not all services (stubbed)', async () => {
        const omni = await AppFixture.start({ config: test_service_config })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            // startTranslationTestServer sets translate_service_list to ['mymemory@e2e'].
            // Add bing@default as a second service for the retry test.
            await omni.api.setConfig({
                translate_service_list: ['mymemory@e2e', 'bing@default'],
                service_instances: {
                    ...(await omni.api.getConfig())['service_instances'] as Record<string, unknown>,
                    'bing@default': { serviceKey: 'bing', config: {} },
                },
            })

            const translate = await omni.translate()

            // mymemory succeeds; bing will fail via fetch interception.
            server.set_mymemory_response({ translated_text: '成功结果', status: 200 })
            await translate.page.evaluate(() => {
                const original_fetch = window.fetch.bind(window)
                window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
                    if (url.includes('bing.com') || url.includes('ttranslatev3')) {
                        return new Response(JSON.stringify({ error: 'mock failure' }), { status: 500, headers: { 'content-type': 'application/json' } })
                    }
                    return original_fetch(input, init)
                }
            })

            await translate.typeSource('hello retry')
            await translate.clickTranslate()
            await expect(translate.resultBody('mymemory@e2e')).toContainText('成功结果', { timeout: 15_000 })
            await expect(translate.resultError('bing@default')).toBeVisible({ timeout: 30_000 })

            // Spec §5.4: 重试只重新调用该服务实例。
            // Retry bing — mymemory should NOT re-translate.
            server.clear_requests()
            await translate.clickResultRetry('bing@default')
            // mymemory should still show the old result (no new request to server).
            await expect(translate.resultBody('mymemory@e2e')).toContainText('成功结果')
            // bing re-triggers (will fail again with mock).
            await expect(translate.resultError('bing@default')).toBeVisible({ timeout: 30_000 })
            // No new request to the translation test server (mymemory was not retried).
            expect(server.request_count).toBe(0)
        } finally {
            await server?.stop()
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
