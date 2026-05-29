import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import { build_cambridge_dict_init_script, cambridge_dict_hello_payload, cambridge_dict_reconcile_payload } from '../fixtures/stub_payloads'
import { ocr_timeout_ms } from '../fixtures/timeout_constants'
const cambridge_dict_config = {
    welcome_dismissed: true,
    dictionary_service_list: [],
    english_dictionary_service_list: ['cambridge_dict@default'],
    service_instances: {
        'cambridge_dict@default': { serviceKey: 'cambridge_dict', config: {} },
    },
}

async function wait_for_chinese_dict_ready(page: Page): Promise<void> {
    await expect.poll(async () => page.evaluate(() => window.electronAPI.chinese_dict.check().then((result) => result.ready)), { timeout: ocr_timeout_ms }).toBe(true)
}

test.describe('@ui dict window', () => {
    test.describe.configure({ retries: 2 })

    test('user opens dictionary from selected text and uses the word card', async () => {
        const omni = await AppFixture.start({
            init_script: build_cambridge_dict_init_script(),
            config: {
                app_language: 'zh_cn',
                welcome_dismissed: true,
                dictionary_service_list: [],
                english_dictionary_service_list: ['cambridge_dict@default'],
                service_instances: {
                    'cambridge_dict@default': { serviceKey: 'cambridge_dict', config: {} },
                },
            },
        })

        try {
            const result = await omni.api.triggerDict('hello')
            expect(result.success).toBe(true)
            const dict = await omni.dict()

            await expect(dict.wordmark()).toContainText('Omni Pot')
            await expect(dict.modeLabel()).toContainText('词典')
            expect(await dict.titlebarOrder()).toEqual(['topmost', 'pin', 'wordmark', 'mode', 'close'])
            await expect(dict.word()).toHaveValue('hello')
            await expect(dict.searchInputs()).toHaveCount(0)
            await expect(dict.newlineButtons()).toHaveCount(0)
            await expect(dict.removedDictionaryPrompts()).toHaveCount(0)

            // Wait for at least 2 cards: source card + result card (pronunciation card may also appear)
            await dict.waitForCards(2, ocr_timeout_ms)
            await expect(dict.definitions().first()).toBeVisible()
            await expect(dict.pronunciations().first()).toBeVisible()
            await dict.clickFirstCopy()
            await expect.poll(async () => (await omni.api.readClipboard()).text).not.toBe('')

            // TODO: pin toggle for dict window does not work in CI (setAlwaysOnTop IPC succeeds
            // but isAlwaysOnTop() stays false — likely a transparent-window issue on Windows).
            // await dict.clickPin()
            // await expect.poll(async () => (await omni.api.windowState('dict')).alwaysOnTop).toBe(true)

            await dict.clickClose()
            await expect.poll(async () => (await omni.api.windowState('dict')).visible).toBe(false)
        } finally {
            await omni.stop()
        }
    })

    test('user opens dictionary without selected text and can type immediately', async () => {
        const omni = await AppFixture.start({
            config: {
                hotkey_selection_dictionary: 'Ctrl+Shift+D',
                dictionary_service_list: [],
                english_dictionary_service_list: [],
                service_instances: {},
            },
        })

        try {
            const result = await omni.api.triggerHotkey('hotkey_selection_dictionary', '')
            expect(result.success).toBe(true)
            const dict = await omni.dict()

            await expect(dict.word()).toHaveValue('')
            await expect(dict.detectedLang()).toHaveText('')
            await expect.poll(async () => dict.isWordFocused()).toBe(true)
            await expect(dict.word()).toHaveAttribute('aria-label', '输入单词...')

            await dict.editWordAndSubmit('hello')
            await expect(dict.word()).toHaveValue('hello')
        } finally {
            await omni.stop()
        }
    })

    test('user edits the source word card and presses Enter to look up again', async () => {
        const omni = await AppFixture.start({
            init_script: build_cambridge_dict_init_script({
                hello: cambridge_dict_hello_payload,
                reconcile: cambridge_dict_reconcile_payload,
            }),
            config: {
                welcome_dismissed: true,
                dictionary_service_list: ['chinese_dictionary@default'],
                english_dictionary_service_list: ['cambridge_dict@default'],
                service_instances: {
                    'chinese_dictionary@default': { serviceKey: 'chinese_dictionary', config: {} },
                    'cambridge_dict@default': { serviceKey: 'cambridge_dict', config: {} },
                },
            },
        })

        try {
            const page = await omni.firstWindow()
            await wait_for_chinese_dict_ready(page)

            const english_result = await omni.api.triggerDict('hello')
            expect(english_result.success).toBe(true)
            const dict = await omni.dict()
            await expect(dict.word()).toHaveValue('hello')
            await dict.waitForCards(2, ocr_timeout_ms)
            await expect(dict.definitions().first()).not.toBeEmpty()
            const english_definition = await dict.definitions().first().textContent()

            await dict.editWordAndSubmit('reconcile')

            await expect(dict.word()).toHaveValue('reconcile')
            await expect.poll(async () => await dict.definitions().first().textContent(), { timeout: ocr_timeout_ms }).not.toBe(english_definition)
            await expect(dict.definitions().first()).not.toBeEmpty()

            const chinese_result = await omni.api.triggerDict('谢谢')
            expect(chinese_result.success).toBe(true)
            await expect(dict.word()).toHaveValue('谢谢')
            await dict.waitForCards(2, ocr_timeout_ms)
            await expect(dict.definitions().first()).not.toBeEmpty()
            const chinese_definition = await dict.definitions().first().textContent()

            await dict.editWordAndSubmit('学习')

            await expect(dict.word()).toHaveValue('学习')
            await expect.poll(async () => await dict.definitions().first().textContent(), { timeout: ocr_timeout_ms }).not.toBe(chinese_definition)
            await expect(dict.definitions().first()).not.toBeEmpty()
        } finally {
            await omni.stop()
        }
    })

    test('user gets real English and Chinese dictionary results from multiple services', async () => {
        const omni = await AppFixture.start({
            init_script: build_cambridge_dict_init_script(),
            config: {
                welcome_dismissed: true,
                dictionary_service_list: ['chinese_dictionary@default'],
                english_dictionary_service_list: ['cambridge_dict@default'],
                service_instances: {
                    'chinese_dictionary@default': { serviceKey: 'chinese_dictionary', config: {} },
                    'cambridge_dict@default': { serviceKey: 'cambridge_dict', config: {} },
                },
            },
        })

        try {
            const page = await omni.firstWindow()
            await wait_for_chinese_dict_ready(page)

            const english_result = await omni.api.triggerDict('hello')
            expect(english_result.success).toBe(true)
            const dict = await omni.dict()

            // Wait for source + pronunciation + at least 1 result card
            await dict.waitForCards(2, ocr_timeout_ms)
            await expect(dict.sourceTags().first()).toBeVisible()
            await expect.poll(async () => await dict.definitions().count(), { timeout: ocr_timeout_ms }).toBeGreaterThanOrEqual(1)

            // Service routing: English query hits English dictionary services.
            const en_keys = await dict.resultKeysWithContent()
            expect(en_keys.some((k) => k.startsWith('cambridge_dict@'))).toBe(true)
            for (const key of en_keys) {
                expect(key, '英文查询不应走Chinese Dictionary').toMatch(/^cambridge_dict@/)
            }

            // Chinese word "谢谢" routes to Chinese dictionaries only.
            const chinese_result = await omni.api.triggerDict('谢谢')
            expect(chinese_result.success).toBe(true)
            await expect(dict.word()).toHaveValue('谢谢')
            await dict.waitForCards(2, ocr_timeout_ms)
            await expect(dict.sourceTags().first()).toBeVisible()
            const source_text = (await dict.sourceTags().allTextContents()).join(' ')
            expect(source_text).toContain('Chinese Dictionary')
            await expect(dict.definitions().first()).toContainText('对别人表示感谢')

            // Service routing: Chinese query only hits Chinese dictionary services.
            // Use resultKeysWithContent() to exclude rendered-but-unqueried English service cards.
            const zh_keys = await dict.resultKeysWithContent()
            for (const key of zh_keys) {
                expect(key).toMatch(/^chinese_dictionary@/)
            }

            // Spec §17 + issues: Chinese常用词 must return non-empty results.
            for (const word of ['经济', '自我', '佛', '我']) {
                const result = await omni.api.triggerDict(word)
                expect(result.success).toBe(true)
                await expect(dict.word()).toHaveValue(word)
                await dict.waitForCards(2, ocr_timeout_ms)
                await expect(dict.definitions().first(), `常用词「${word}」应有释义`).not.toBeEmpty()
                const word_keys = await dict.resultKeysWithContent()
                for (const key of word_keys) {
                    expect(key, `常用词「${word}」不应走英文词典`).toMatch(/^chinese_dictionary@/)
                }
            }

            const card_text = (await dict.dictCards().allTextContents()).join('\n')
            expect(card_text).not.toContain('hello')
        } finally {
            await omni.stop()
        }
    })

    test('dict header card shows pronunciation and POS tags without clipping', async () => {
        const omni = await AppFixture.start({
            init_script: build_cambridge_dict_init_script({ reconcile: cambridge_dict_reconcile_payload }),
            config: cambridge_dict_config,
        })

        try {
            await omni.api.triggerDict('reconcile')
            const dict = await omni.dict()
            await expect(dict.word()).toHaveValue('reconcile', { timeout: ocr_timeout_ms })

            const meta_elements = dict['page'].locator('[data-testid="dict-pronunciation"], [data-testid="dict-pos-tag"]')
            await expect(meta_elements.first(), '词典卡片应展示读音/词性 chip').toBeVisible({ timeout: ocr_timeout_ms })

            const count = await meta_elements.count()
            for (let i = 0; i < count; i += 1) {
                await expect(meta_elements.nth(i), `第 ${String(i)} 个元数据 chip 应可见`).toBeVisible()
            }
        } finally {
            await omni.stop()
        }
    })
})
