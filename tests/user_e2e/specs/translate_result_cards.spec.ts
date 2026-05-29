import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import type { TranslationTestServer } from '../fixtures/translation_test_server'
import { build_cambridge_dict_init_script } from '../fixtures/stub_payloads'
import { local_translation_timeout_ms, network_translation_timeout_ms } from '../fixtures/timeout_constants'

const test_service_config = {
    app_language: 'zh_cn',
    dynamic_translate: false,
    translate_source_language: 'en',
    translate_target_language: 'zh_cn',
    tts_service_list: ['system_tts@default'],
    service_instances: {
        'system_tts@default': { serviceKey: 'system_tts', config: {} },
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

            await expect(translate.resultCard('mymemory@e2e')).toBeVisible({ timeout: local_translation_timeout_ms })
            await expect(translate.resultCard('mymemory@e2e').getByTestId('result-loading')).toBeVisible()
            await expect(translate.resultBody('mymemory@e2e')).toHaveCount(0)
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'false')

            await expect(translate.resultBody('mymemory@e2e')).toContainText('你好世界', { timeout: local_translation_timeout_ms })
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'true')
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('user copies, collapses, expands, and retries a result card (stubbed - local HTTP server)', async () => {
        const omni = await AppFixture.start({ config: test_service_config })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            server.set_mymemory_response({ translated_text: '', status: 500 })
            await translate.typeSource('hello world')
            await translate.clickTranslate()

            await expect(translate.resultError('mymemory@e2e')).toContainText('翻译失败', { timeout: local_translation_timeout_ms })
            await expect(translate.resultRetryButton('mymemory@e2e')).toBeVisible()

            server.set_mymemory_response({ translated_text: '你好世界', status: 200 })
            await translate.clickResultRetry('mymemory@e2e')
            await expect(translate.resultBody('mymemory@e2e')).toContainText('你好世界', { timeout: local_translation_timeout_ms })
            await expect(translate.resultRetryButton('mymemory@e2e')).toHaveCount(0)

            await translate.clickResultCopy('mymemory@e2e')
            await expect.poll(async () => (await omni.api.readClipboard()).text).toBe('你好世界')

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

            await expect(translate.resultCard('mymemory@e2e')).toBeVisible({ timeout: local_translation_timeout_ms })
            await expect(translate.resultCard('mymemory@e2e').getByTestId('result-loading')).toContainText('翻译中')
            await expect(translate.resultCard('mymemory@e2e')).not.toContainText('stream')

            await expect(translate.resultBody('mymemory@e2e')).toContainText('你好世界', { timeout: local_translation_timeout_ms })
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
            await expect(translate.resultBody('mymemory@e2e')).toContainText('第一轮结果', { timeout: local_translation_timeout_ms })

            // Spec §5.4: 用户手动折叠后保持状态。
            await translate.clickResultCollapse('mymemory@e2e')
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'false')

            // A second translation request should reset the collapse state.
            server.set_mymemory_response({ translated_text: '第二轮结果', status: 200 })
            await translate.typeSource('second request')
            await translate.clickTranslate()
            await expect(translate.resultBody('mymemory@e2e')).toContainText('第二轮结果', { timeout: local_translation_timeout_ms })
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
            server = await omni.startTranslationTestServer(['mymemory@e2e_ok', 'mymemory@e2e_fail'])
            const translate = await omni.translate()

            server.set_mymemory_response({ translated_text: '成功结果', status: 200 }, 'mymemory@e2e_ok')
            server.set_mymemory_response({ translated_text: '', status: 500 }, 'mymemory@e2e_fail')

            await translate.typeSource('hello retry')
            await translate.clickTranslate()
            await expect(translate.resultBody('mymemory@e2e_ok')).toContainText('成功结果', { timeout: local_translation_timeout_ms })
            await expect(translate.resultError('mymemory@e2e_fail')).toBeVisible({ timeout: local_translation_timeout_ms })

            server.clear_requests()
            await translate.clickResultRetry('mymemory@e2e_fail')
            await expect(translate.resultBody('mymemory@e2e_ok')).toContainText('成功结果')
            await expect(translate.resultError('mymemory@e2e_fail')).toBeVisible({ timeout: local_translation_timeout_ms })
            expect(server.requests.some((request) => request.url.includes('key=mymemory%40e2e_ok'))).toBe(false)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('user drags result cards to persist translation service order', async () => {
        const omni = await AppFixture.start({
            config: {
                dynamic_translate: false,
                translate_service_list: ['mymemory@e2e_a', 'mymemory@e2e_b'],
                service_instances: {
                    'mymemory@e2e_a': { serviceKey: 'mymemory', config: { instanceName: 'MyMemory A' } },
                    'mymemory@e2e_b': { serviceKey: 'mymemory', config: { instanceName: 'MyMemory B' } },
                },
            },
        })

        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer(['mymemory@e2e_a', 'mymemory@e2e_b'])
            server.set_mymemory_response({ translated_text: '你好', status: 200 }, 'mymemory@e2e_a')
            server.set_mymemory_response({ translated_text: '你好', status: 200 }, 'mymemory@e2e_b')
            const translate = await omni.translate()
            await translate.typeSource('hello')
            await translate.clickTranslate()

            await expect(translate.resultCards()).toHaveCount(2)
            await expect(translate.resultCards().nth(0)).toHaveAttribute('data-result-key', 'mymemory@e2e_a')
            await expect(translate.resultCards().nth(1)).toHaveAttribute('data-result-key', 'mymemory@e2e_b')

            await translate.drag_result_card('mymemory@e2e_b', 'mymemory@e2e_a')

            await expect(translate.resultCards().nth(0)).toHaveAttribute('data-result-key', 'mymemory@e2e_b')
            await expect(translate.resultCards().nth(1)).toHaveAttribute('data-result-key', 'mymemory@e2e_a')

            const config = await omni.openConfig()
            await config.openSection('service')
            await expect.poll(() => config.serviceItemKeys()).toEqual(['mymemory@e2e_b', 'mymemory@e2e_a'])
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('user drags result cards with disabled services interleaved and sees full settings order', async () => {
        const omni = await AppFixture.start({
            config: {
                dynamic_translate: false,
                translate_service_list: ['mymemory@e2e_a', 'mymemory@e2e_disabled', 'mymemory@e2e_b'],
                service_instances: {
                    'mymemory@e2e_a': { serviceKey: 'mymemory', config: { instanceName: 'MyMemory A' } },
                    'mymemory@e2e_disabled': { serviceKey: 'mymemory', config: { enable: false, instanceName: 'MyMemory Disabled' } },
                    'mymemory@e2e_b': { serviceKey: 'mymemory', config: { instanceName: 'MyMemory B' } },
                },
            },
        })

        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer(['mymemory@e2e_a', 'mymemory@e2e_b'])
            server.set_mymemory_response({ translated_text: '你好', status: 200 }, 'mymemory@e2e_a')
            server.set_mymemory_response({ translated_text: '你好', status: 200 }, 'mymemory@e2e_b')
            // Restore the disabled instance to the service list (startTranslationTestServer only
            // sets up enabled instances and overwrites translate_service_list).
            await omni.api.setConfig({
                translate_service_list: ['mymemory@e2e_a', 'mymemory@e2e_disabled', 'mymemory@e2e_b'],
            })
            const translate = await omni.translate()
            await translate.typeSource('hello')
            await translate.clickTranslate()

            await expect(translate.resultCards()).toHaveCount(2)
            await expect(translate.resultCards().nth(0)).toHaveAttribute('data-result-key', 'mymemory@e2e_a')
            await expect(translate.resultCards().nth(1)).toHaveAttribute('data-result-key', 'mymemory@e2e_b')

            await translate.drag_result_card('mymemory@e2e_b', 'mymemory@e2e_a')

            await expect(translate.resultCards().nth(0)).toHaveAttribute('data-result-key', 'mymemory@e2e_b')
            await expect(translate.resultCards().nth(1)).toHaveAttribute('data-result-key', 'mymemory@e2e_a')
            const config = await omni.openConfig()
            await config.openSection('service')
            await expect.poll(() => config.serviceItemKeys()).toEqual(['mymemory@e2e_b', 'mymemory@e2e_disabled', 'mymemory@e2e_a'])

            await config.clickClose()
            const open_result = await omni.api.openWindow('translate')
            expect(open_result.success).toBe(true)
            const translate_after_config = await omni.translate()
            await translate_after_config.typeSource('hello')
            await translate_after_config.clickTranslate()
            await expect(translate_after_config.resultCards()).toHaveCount(2)
            await expect(translate_after_config.resultCards().nth(0)).toHaveAttribute('data-result-key', 'mymemory@e2e_b')
            await expect(translate_after_config.resultCards().nth(1)).toHaveAttribute('data-result-key', 'mymemory@e2e_a')

            await translate_after_config.drag_result_card('mymemory@e2e_a', 'mymemory@e2e_b')

            await expect(translate_after_config.resultCards().nth(0)).toHaveAttribute('data-result-key', 'mymemory@e2e_a')
            await expect(translate_after_config.resultCards().nth(1)).toHaveAttribute('data-result-key', 'mymemory@e2e_b')
            const config_after_reverse = await omni.openConfig()
            await config_after_reverse.openSection('service')
            await expect.poll(() => config_after_reverse.serviceItemKeys()).toEqual(['mymemory@e2e_a', 'mymemory@e2e_disabled', 'mymemory@e2e_b'])
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test.describe('network dictionary result cards', () => {
        test.describe.configure({ retries: 2 })

        test('dictionary result cards render pronunciation, definitions, and examples', async () => {
            const omni = await AppFixture.start({
                init_script: build_cambridge_dict_init_script(),
                config: {
                    dynamic_translate: false,
                    translate_service_list: ['cambridge_dict@default'],
                    service_instances: {
                        'cambridge_dict@default': { serviceKey: 'cambridge_dict', config: {} },
                    },
                },
            })

            try {
                const translate = await omni.translate()
                await translate.typeSource('hello')
                await translate.clickTranslate()

                await expect(translate.resultCard('cambridge_dict@default')).toBeVisible()
                await expect(translate.resultBody('cambridge_dict@default')).toContainText('exclamation', { timeout: network_translation_timeout_ms })
                await expect(translate.resultBody('cambridge_dict@default')).toContainText('greeting', { timeout: network_translation_timeout_ms })
            } finally {
                await omni.stop()
            }
        })
    })
})
