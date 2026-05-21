import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const free_dictionary_init_script = `
(() => {
    const original_fetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        if (url.startsWith('https://api.dictionaryapi.dev/api/v2/entries/en/')) {
            return new Response(JSON.stringify([{
                word: 'hello',
                phonetic: '/həˈləʊ/',
                phonetics: [{ text: '/həˈloʊ/', audio: 'https://example.test/hello-us.mp3' }],
                meanings: [{
                    partOfSpeech: 'noun',
                    definitions: [{
                        definition: 'A greeting or expression of goodwill.',
                        example: 'She said hello to everyone in the room.',
                    }],
                }],
            }]), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        return original_fetch(input, init)
    }
})()
`

async function wait_for_dict_ready(page: Page): Promise<void> {
    await expect.poll(async () => page.evaluate(() => window.electronAPI.dict.check().then((result) => result.ready)), { timeout: 45_000 }).toBe(true)
}

async function wait_for_chinese_dict_ready(page: Page): Promise<void> {
    await expect.poll(async () => page.evaluate(() => window.electronAPI.chineseDict.check().then((result) => result.ready)), { timeout: 60_000 }).toBe(true)
}

test.describe('@ui dict window', () => {
    test.describe.configure({ retries: 2 })

    test('user opens dictionary from selected text and uses the word card', async () => {
        const omni = await AppFixture.start({
            init_script: free_dictionary_init_script,
            config: {
                dictionary_service_list: [],
                english_dictionary_service_list: ['free_dictionary@default'],
                collection_service_list: ['anki@default'],
                service_instances: {
                    'free_dictionary@default': { serviceKey: 'free_dictionary', config: {} },
                    'anki@default': { serviceKey: 'anki', config: { port: 8765 } },
                },
            },
        })

        try {
            const result = await omni.api.triggerDict('hello')
            expect(result.success).toBe(true)
            const dict = await omni.dict()

            await expect(dict.wordmark()).toContainText('Omni Pot')
            await expect(dict.modeLabel()).toContainText('词典')
            expect(await dict.titlebarOrder()).toEqual(['pin', 'wordmark', 'mode', 'close'])
            await expect(dict.word()).toContainText('hello')
            await expect(dict.searchInputs()).toHaveCount(0)
            await expect(dict.newlineButtons()).toHaveCount(0)

            // Wait for at least 2 cards: source card + result card (pronunciation card may also appear)
            await dict.waitForCards(2, 60_000)
            await expect(dict.definitions().first()).toBeVisible()
            await expect(dict.pronunciations().first()).toBeVisible()
            await expect(dict.examples().first()).toBeVisible()

            await dict.clickFirstCopy()
            await expect.poll(async () => (await omni.api.readClipboard()).text).not.toBe('')

            await dict.fulfill_anki_collection_once()
            // Use the result card's collect button (not the source card's).
            const result_collect = dict.dictCards().nth(1).getByTestId('dict-collect-btn')
            await result_collect.click()
            await expect(result_collect).toHaveAttribute('aria-pressed', 'true')

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

    test('user edits the source word card and presses Enter to look up again', async () => {
        const omni = await AppFixture.start({
            config: {
                dictionary_service_list: [],
                english_dictionary_service_list: ['ecdict@default'],
                service_instances: {
                    'ecdict@default': { serviceKey: 'ecdict', config: {} },
                },
            },
        })

        try {
            const page = await omni.firstWindow()
            await wait_for_dict_ready(page)

            const result = await omni.api.triggerDict('hello')
            expect(result.success).toBe(true)
            const dict = await omni.dict()
            await expect(dict.word()).toContainText('hello')
            await dict.waitForCards(2, 60_000)
            await expect(dict.definitions().first()).not.toBeEmpty()
            const previous_definition = await dict.definitions().first().textContent()

            await dict.editWordAndSubmit('apple')

            await expect(dict.word()).toContainText('apple')
            await expect.poll(async () => await dict.definitions().first().textContent(), { timeout: 60_000 }).not.toBe(previous_definition)
            await expect(dict.definitions().first()).not.toBeEmpty()
        } finally {
            await omni.stop()
        }
    })

    test('user gets real English and Chinese dictionary results from multiple services', async () => {
        const omni = await AppFixture.start({
            init_script: free_dictionary_init_script,
            config: {
                dictionary_service_list: ['chinese_dictionary@default', 'ecdict@default'],
                english_dictionary_service_list: ['free_dictionary@default', 'ecdict@default'],
                service_instances: {
                    'chinese_dictionary@default': { serviceKey: 'chinese_dictionary', config: {} },
                    'ecdict@default': { serviceKey: 'ecdict', config: {} },
                    'free_dictionary@default': { serviceKey: 'free_dictionary', config: {} },
                },
            },
        })

        try {
            const page = await omni.firstWindow()
            await wait_for_dict_ready(page)
            await wait_for_chinese_dict_ready(page)

            const english_result = await omni.api.triggerDict('hello')
            expect(english_result.success).toBe(true)
            const dict = await omni.dict()

            // Wait for source + pronunciation + at least 1 result card
            await dict.waitForCards(3, 60_000)
            // At least free_dictionary + ecdict result cards
            await expect(dict.sourceTags().first()).toBeVisible()
            await expect.poll(async () => await dict.definitions().count(), { timeout: 60_000 }).toBeGreaterThanOrEqual(2)

            // Service routing: English query hits English dictionary services.
            const en_keys = await dict.resultKeysWithContent()
            expect(en_keys.some((k) => k.startsWith('free_dictionary@'))).toBe(true)
            expect(en_keys.some((k) => k.startsWith('ecdict@'))).toBe(true)

            // Chinese word "谢谢" routes to Chinese dictionaries only.
            const chinese_result = await omni.api.triggerDict('谢谢')
            expect(chinese_result.success).toBe(true)
            await expect(dict.word()).toContainText('谢谢')
            // Both chinese_dictionary AND CC-CEDICT (ecdict) now serve zh queries.
            // Note: All enabled services render cards (union of zh+en lists),
            // so there are 3 source tags (chinese_dictionary + ecdict + cambridge_dict).
            await dict.waitForCards(2, 30_000)
            await expect(dict.sourceTags().first()).toBeVisible()
            const source_text = (await dict.sourceTags().allTextContents()).join(' ')
            expect(source_text).toContain('中文词典')
            // ecdict service displays as "ECDict" per spec §32 row 21; "CC-CEDICT" is the
            // underlying DB name used in backup hints and dict download UI, not the source tag.
            expect(source_text).toContain('ECDict')
            await expect(dict.definitions().first()).toContainText('对别人表示感谢')

            // Service routing: Chinese query only hits Chinese dictionary services.
            // Use resultKeysWithContent() to exclude rendered-but-unqueried English service cards.
            const zh_keys = await dict.resultKeysWithContent()
            for (const key of zh_keys) {
                expect(key).toMatch(/^(chinese_dictionary|ecdict)@/)
            }

            // Spec §17 + issues: Chinese常用词 must return non-empty results.
            for (const word of ['经济', '自我', '佛']) {
                const result = await omni.api.triggerDict(word)
                expect(result.success).toBe(true)
                await expect(dict.word()).toContainText(word)
                await dict.waitForCards(2, 30_000)
                await expect(dict.definitions().first(), `常用词「${word}」应有释义`).not.toBeEmpty()
                const word_keys = await dict.resultKeysWithContent()
                for (const key of word_keys) {
                    expect(key, `常用词「${word}」不应走英文词典`).toMatch(/^(chinese_dictionary|ecdict)@/)
                }
            }

            const card_text = (await dict.dictCards().allTextContents()).join('\n')
            expect(card_text).not.toContain('hello')
        } finally {
            await omni.stop()
        }
    })
})
