import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

test.describe('@ui translate source area', () => {
    test('user can edit, normalize, copy, and clear source text', async ({ omni }) => {
        const translate = await omni.translate()
        await translate.dismissWelcome()

        await expect(translate.sourceInput()).toHaveAttribute('rows', '1')
        const initial_height = await translate.sourceInput().evaluate((el) => (el as HTMLTextAreaElement).clientHeight)
        await expect(translate.clearSourceButton()).toBeDisabled()
        await expect(translate.sourceTtsButton()).toBeDisabled()

        await translate.typeSource('hello\nworld')
        await expect(translate.sourceInput()).toHaveValue('hello\nworld')
        await expect.poll(async () => await translate.sourceInput().evaluate((el) => (el as HTMLTextAreaElement).clientHeight)).toBeGreaterThan(initial_height)
        await expect(translate.clearSourceButton()).toBeEnabled()
        await expect(translate.sourceTtsButton()).toBeEnabled()

        await translate.clickDeleteNewline()
        await expect(translate.sourceInput()).toHaveValue('hello world')

        await translate.clickCopySource()
        await expect.poll(async () => (await omni.api.readClipboard()).text).toBe('hello world')

        await translate.clickClearSource()
        await expect(translate.sourceInput()).toHaveValue('')
        await expect(translate.clearSourceButton()).toBeDisabled()
        await expect(translate.sourceTtsButton()).toBeDisabled()
    })

    test('source input caps growth at eight lines and scrolls internally', async ({ omni }) => {
        const translate = await omni.translate()
        await translate.dismissWelcome()

        await translate.typeSource(Array.from({ length: 12 }, (_, i) => `line ${(i + 1).toString()}`).join('\n'))

        const metrics = await translate.sourceInput().evaluate((el) => {
            const textarea = el as HTMLTextAreaElement
            const style = getComputedStyle(textarea)
            return {
                client_height: textarea.clientHeight,
                scroll_height: textarea.scrollHeight,
                max_height: Number.parseFloat(style.maxHeight),
            }
        })

        expect(metrics.client_height).toBeLessThanOrEqual(metrics.max_height + 1)
        expect(metrics.scroll_height).toBeGreaterThan(metrics.client_height)
    })

    test('IME composition enter does not submit translation', async () => {
        const omni = await AppFixture.start({
            config: { dynamic_translate: false, translate_service_list: [] },
        })

        try {
            const translate = await omni.translate()

            await translate.typeSource('hello world')
            await translate.dispatchComposingEnter()
            await expect(translate.detectedLanguage()).toHaveCount(0)
            await expect(translate.resultCards()).toHaveCount(0)
            await translate.waitForNoDetectedLanguage()
        } finally {
            await omni.stop()
        }
    })

    test('clearing source cancels an in-flight translation', async () => {
        const omni = await AppFixture.start({
            config: {
                dynamic_translate: false,
                translate_service_list: ['lingva@default'],
                service_instances: {
                    'lingva@default': { serviceKey: 'lingva', config: { requestPath: 'https://lingva.lunar.icu' } },
                },
            },
        })

        try {
            const translate = await omni.translate()

            const held_translation = await translate.hold_lingva_translation_once('stale translation')
            await translate.typeSource('hello world')
            await translate.clickTranslate()
            await held_translation.wait_for_request()
            await translate.clickClearSource()
            await held_translation.release_response()

            await expect(translate.sourceInput()).toHaveValue('')
            await expect.poll(async () => await translate.resultBodies().count(), { timeout: 2_000 }).toBe(0)
        } finally {
            await omni.stop()
        }
    })

    test.describe('network source actions', () => {
        test.describe.configure({ retries: 2 })

        test('user uses keyboard shortcuts in the source input', async ({ omni }) => {
            const translate = await omni.translate()

            await translate.typeSource('hello')
            await translate.pressSource('Shift+Enter')
            await expect(translate.sourceInput()).toHaveValue('hello\n')
            await translate.sourceInput().pressSequentially('world')

            await translate.pressSource('Enter')
            await expect.poll(async () => await translate.resultBodies().count(), { timeout: 45_000 }).toBeGreaterThan(0)
        })

        test('source TTS button is enabled with text and disabled when cleared', async ({ omni }) => {
            const translate = await omni.translate()
            await translate.typeSource('hello world')
            await expect(translate.sourceTtsButton()).toBeEnabled()
            await expect(translate.sourceTtsButton()).toHaveAttribute('aria-pressed', 'false')

            await translate.clickClearSource()
            await expect(translate.sourceTtsButton()).toBeDisabled()
        })

        test('user clicks source TTS and sees playback state', async () => {
            test.setTimeout(120_000)

            // system_tts uses the renderer Web Speech API. We stub it via
            // init_script so the test deterministically controls when playback
            // "ends" by holding back `onend` until cancel is invoked.
            const omni = await AppFixture.start({
                config: {
                    app_language: 'zh_cn',
                    tts_service_list: ['system_tts@default'],
                    service_instances: {
                        'system_tts@default': { serviceKey: 'system_tts', config: {} },
                    },
                },
                init_script: `
                    const fake_voice = { lang: 'zh-CN', name: 'Fake-zh', default: true, localService: true, voiceURI: 'fake' };
                    window.__last_utterance = null;
                    window.__keep_speaking = true;
                    Object.defineProperty(window, 'speechSynthesis', {
                        configurable: true,
                        value: {
                            speaking: false, paused: false, pending: false,
                            getVoices: () => [fake_voice],
                            speak: (u) => {
                                window.__last_utterance = u;
                                if (!window.__keep_speaking) setTimeout(() => u.onend && u.onend(new Event('end')), 30);
                            },
                            cancel: () => { const u = window.__last_utterance; if (u && u.onend) u.onend(new Event('end')) },
                            addEventListener: () => {},
                            removeEventListener: () => {},
                        },
                    });
                `,
            })

            try {
                const translate = await omni.translate()
                const source_text = '你好世界。你好世界。你好世界。你好世界。'

                await translate.typeSource(source_text)
                await expect(translate.sourceTtsButton()).toBeEnabled()
                await expect(translate.sourceTtsButton()).toHaveAttribute('aria-pressed', 'false')

                await translate.clickSourceTts()
                await expect(translate.sourceTtsButton()).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 })
                await expect(translate.sourceTtsButton()).toHaveAttribute('title', '取消朗读')
                await expect(translate.sourceInput()).toHaveValue(source_text)

                await translate.clickSourceTts()
                await expect(translate.sourceTtsButton()).toHaveAttribute('aria-pressed', 'false')

                await translate.clickSourceTts()
                await expect(translate.sourceTtsButton()).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 })
                await translate.clickClearSource()
                await expect(translate.sourceInput()).toHaveValue('')
                await expect(translate.sourceTtsButton()).toHaveAttribute('aria-pressed', 'false')
                await expect(translate.sourceTtsButton()).toBeDisabled()
            } finally {
                await omni.stop()
            }
        })

        test('source TTS uses the current text language, not the previously detected one', async () => {
            const omni = await AppFixture.start({
                config: {
                    dynamic_translate: false,
                    translate_service_list: [],
                    translate_detect_engine: 'local',
                    tts_service_list: ['system_tts@default'],
                    service_instances: {
                        'system_tts@default': { serviceKey: 'system_tts', config: {} },
                    },
                },
                init_script: `
                    const voices = [
                        { lang: 'en-US', name: 'Fake-en', default: false, localService: true, voiceURI: 'fake_en' },
                        { lang: 'zh-CN', name: 'Fake-zh', default: false, localService: true, voiceURI: 'fake_zh' },
                    ];
                    window.__spoken_langs = [];
                    Object.defineProperty(window, 'speechSynthesis', {
                        configurable: true,
                        value: {
                            speaking: false, paused: false, pending: false,
                            getVoices: () => voices,
                            speak: (u) => { window.__spoken_langs.push(u.lang); setTimeout(() => u.onend && u.onend(new Event('end')), 30) },
                            cancel: () => {},
                            addEventListener: () => {},
                            removeEventListener: () => {},
                        },
                    });
                `,
            })

            try {
                const translate = await omni.translate()

                await translate.typeSource('hello world')
                await translate.clickTranslate()
                await expect(translate.detectedLanguage()).toBeVisible()

                await translate.typeSource('你好世界')
                await translate.clickSourceTts()

                await expect.poll(
                    async () => translate.sourceInput().page().evaluate(
                        () => (window as unknown as { __spoken_langs: string[] }).__spoken_langs.at(-1),
                    ),
                    { timeout: 10_000 },
                ).toBe('zh-CN')
            } finally {
                await omni.stop()
            }
        })

        test('user clicks translate and sees a real result body', async ({ omni }) => {
            const translate = await omni.translate()

            await translate.typeSource('hello world')
            await translate.clickTranslate()

            await expect.poll(async () => await translate.resultBodies().count(), { timeout: 45_000 }).toBeGreaterThan(0)
            await expect.poll(async () => {
                const bodies = translate.resultBodies()
                for (let i = 0; i < await bodies.count(); i += 1) {
                    const text = await bodies.nth(i).textContent()
                    if (text?.trim()) return true
                }
                return false
            }, { timeout: 45_000 }).toBe(true)
        })
    })
})
