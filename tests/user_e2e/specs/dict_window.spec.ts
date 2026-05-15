import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

async function wait_for_dict_ready(page: Page): Promise<void> {
    await expect.poll(async () => page.evaluate(() => window.electronAPI.dict.check().then((result) => result.ready)), { timeout: 45_000 }).toBe(true)
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

            await expect(dict.wordmark()).toContainText('omni_pot')
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
                dictionary_service_list: ['free_dictionary@default', 'ecdict@default', 'cambridge_dict@default'],
                service_instances: {
                    'free_dictionary@default': { serviceKey: 'free_dictionary', config: {} },
                    'ecdict@default': { serviceKey: 'ecdict', config: {} },
                    'cambridge_dict@default': { serviceKey: 'cambridge_dict', config: {} },
                },
            },
        })

        try {
            await wait_for_dict_ready(await omni.firstWindow())

            const english_result = await omni.api.triggerDict('hello')
            expect(english_result.success).toBe(true)
            const dict = await omni.dict()

            await dict.waitForCards(3, 60_000)
            await expect(dict.sourceTags()).toHaveCount(3)
            await expect.poll(async () => await dict.definitions().count(), { timeout: 60_000 }).toBeGreaterThanOrEqual(3)

            const chinese_result = await omni.api.triggerDict('你好')
            expect(chinese_result.success).toBe(true)
            await expect(dict.word()).toContainText('你好')
            await expect.poll(async () => {
                const text = await dict.dictCards().filter({ hasText: 'en' }).first().textContent()
                return text?.trim() ?? ''
            }, { timeout: 60_000 }).not.toBe('')
        } finally {
            await omni.stop()
        }
    })
})
