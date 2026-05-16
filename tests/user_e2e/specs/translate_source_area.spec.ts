import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

test.describe('@ui translate source area', () => {
    test('user can edit, normalize, copy, and clear source text', async ({ omni }) => {
        const translate = await omni.translate()

        await expect(translate.sourceInput()).toHaveAttribute('rows', '1')
        await expect(translate.clearSourceButton()).toBeDisabled()
        await expect(translate.sourceTtsButton()).toBeDisabled()

        await translate.typeSource('hello\nworld')
        await expect(translate.sourceInput()).toHaveValue('hello\nworld')
        await expect(translate.sourceInput()).toHaveAttribute('rows', '2')
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
            held_translation.release_response()

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

        test('user clicks source TTS and sees playback state', async () => {
            test.setTimeout(120_000)

            const omni = await AppFixture.start({
                config: {
                    app_language: 'zh_cn',
                    tts_service_list: ['lingva_tts@default'],
                    service_instances: {
                        'lingva_tts@default': { serviceKey: 'lingva_tts', config: { requestPath: 'https://lingva.lunar.icu' } },
                    },
                },
            })

            try {
                const translate = await omni.translate()
                const source_text = '你好世界。你好世界。你好世界。你好世界。'

                await translate.typeSource(source_text)
                await expect(translate.sourceTtsButton()).toBeEnabled()
                await expect(translate.sourceTtsButton()).toHaveAttribute('aria-pressed', 'false')

                await translate.clickSourceTts()

                await expect(translate.sourceTtsButton()).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 })
                await expect(translate.sourceTtsButton()).toHaveAttribute('title', '停止朗读')
                await expect(translate.sourceInput()).toHaveValue(source_text)

                await translate.clickSourceTts()
                await expect(translate.sourceTtsButton()).toHaveAttribute('aria-pressed', 'false')

                await translate.clickSourceTts()
                await expect(translate.sourceTtsButton()).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 })
                await translate.clickClearSource()
                await expect(translate.sourceInput()).toHaveValue('')
                await expect(translate.sourceTtsButton()).toHaveAttribute('aria-pressed', 'false')
                await expect(translate.sourceTtsButton()).toBeDisabled()
            } finally {
                await omni.stop()
            }
        })

        test('source TTS detects the current text instead of stale detected language', async () => {
            const omni = await AppFixture.start({
                config: {
                    dynamic_translate: false,
                    translate_service_list: [],
                    translate_detect_engine: 'local',
                    tts_service_list: ['lingva_tts@default'],
                    service_instances: {
                        'lingva_tts@default': { serviceKey: 'lingva_tts', config: { requestPath: 'https://lingva.lunar.icu' } },
                    },
                },
            })

            try {
                const translate = await omni.translate()

                await translate.typeSource('hello world')
                await translate.clickTranslate()
                await expect(translate.detectedLanguage()).toBeVisible()

                await translate.typeSource('你好世界')
                const audio_path = await translate.click_source_tts_and_wait_for_audio_path()

                expect(audio_path).toContain('/api/v1/audio/zh/')
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
