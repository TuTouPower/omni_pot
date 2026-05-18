import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

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
            config: {
                dictionary_service_list: ['free_dictionary@default'],
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

            await dict.waitForCards(1, 60_000)
            await expect(dict.definitions().first()).toBeVisible()
            await expect(dict.pronunciations().first()).toBeVisible()
            await expect(dict.examples().first()).toBeVisible()

            await dict.clickFirstCopy()
            await expect.poll(async () => (await omni.api.readClipboard()).text).not.toBe('')

            await dict.fulfill_anki_collection_once()
            await dict.clickCollect()
            await expect(dict.collectButton()).toHaveAttribute('aria-pressed', 'true')

            await dict.clickPin()
            await expect.poll(async () => (await omni.api.windowState('dict')).alwaysOnTop).toBe(true)

            await dict.clickClose()
            await expect.poll(async () => (await omni.api.windowState('dict')).visible).toBe(false)
        } finally {
            await omni.stop()
        }
    })

    test('user gets real English and Chinese dictionary results from multiple services', async () => {
        const omni = await AppFixture.start({
            config: {
                dictionary_service_list: ['chinese_dictionary@default', 'free_dictionary@default', 'ecdict@default', 'cambridge_dict@default'],
                service_instances: {
                    'chinese_dictionary@default': { serviceKey: 'chinese_dictionary', config: {} },
                    'free_dictionary@default': { serviceKey: 'free_dictionary', config: {} },
                    'ecdict@default': { serviceKey: 'ecdict', config: {} },
                    'cambridge_dict@default': { serviceKey: 'cambridge_dict', config: {} },
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

            await dict.waitForCards(3, 60_000)
            await expect(dict.sourceTags()).toHaveCount(3)
            await expect.poll(async () => await dict.definitions().count(), { timeout: 60_000 }).toBeGreaterThanOrEqual(3)

            // Free Dictionary now aggregates all returned entries; "hello" must
            // surface at least two distinct definitions in its own card.
            const free_dict_card = dict['page'].locator('[data-result-key="free_dictionary@default"]')
            await expect.poll(
                async () => await free_dict_card.locator('[data-testid="dict-definition"]').count(),
                { timeout: 30_000 },
            ).toBeGreaterThanOrEqual(2)

            const chinese_result = await omni.api.triggerDict('谢谢')
            expect(chinese_result.success).toBe(true)
            await expect(dict.word()).toContainText('谢谢')
            // Both chinese_dictionary AND CC-CEDICT (ecdict) now serve zh queries.
            await dict.waitForCards(2, 30_000)
            await expect(dict.sourceTags()).toHaveCount(2)
            const source_text = (await dict.sourceTags().allTextContents()).join(' ')
            expect(source_text).toContain('中文词典')
            expect(source_text).toContain('CC-CEDICT')
            await expect(dict.definitions().first()).toContainText('对别人表示感谢')
            const card_text = (await dict.dictCards().allTextContents()).join('\n')
            expect(card_text).not.toContain('hello')
            expect(card_text).not.toContain('en')
        } finally {
            await omni.stop()
        }
    })
})
