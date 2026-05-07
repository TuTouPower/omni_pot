import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
    getTranslateClient, cleanupAllClients,
    clearTextarea, getTextareaValue,
    triggerTranslateViaApi, waitForResults, waitForSourceText,
    readConfig
} from './test_utils'

// Prerequisite: electron-vite dev running with --remote-debugging-port=9225
// Run: npx electron-vite dev -- --remote-debugging-port=9225 &
// Then: npx vitest run tests/user_e2e/01_selection_translate.test.ts

describe('Critical Path 1: 划词翻译全流程', () => {
    beforeAll(async () => {
        const client = await getTranslateClient()
        expect(client).toBeDefined()
    }, 15000)

    afterAll(() => {
        cleanupAllClients()
    })

    it('translates English text sent via HTTP API (simulating selection)', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('hello world')

        await waitForSourceText('hello world', 5000)
        const sourceValue = await getTextareaValue()
        expect(sourceValue).toBe('hello world')
    }, 20000)

    it('shows translation results from enabled services', async () => {
        const serviceList = await readConfig('translate_service_list') as string[]
        expect(serviceList.length).toBeGreaterThan(0)

        // Wait for at least one result card to have content
        const client = await getTranslateClient()
        await client.waitFor(
            async () => {
                const hasContent = await client.evaluate(`
                    (() => {
                        const cards = document.querySelectorAll('[data-result-key]')
                        for (const card of cards) {
                            const textareas = card.querySelectorAll('textarea')
                            const paragraphs = card.querySelectorAll('p')
                            if (textareas.length > 0 || paragraphs.length > 0) return true
                        }
                        return false
                    })()
                `) as boolean
                return hasContent
            },
            15000
        )

        const cardCount = await client.evaluate(
            'document.querySelectorAll("[data-result-key]").length'
        ) as number
        expect(cardCount).toBeGreaterThanOrEqual(1)
    }, 25000)

    it('translates Chinese text via HTTP API', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('你好世界')

        await waitForSourceText('你好世界', 5000)
        const sourceValue = await getTextareaValue()
        expect(sourceValue).toBe('你好世界')

        // Wait for results
        const client = await getTranslateClient()
        await client.waitFor(
            async () => {
                const loading = await client.evaluate(
                    'document.querySelectorAll("[data-result-key] .rrui__spinner, [data-result-key] svg.animate-spin").length'
                ) as number
                return loading === 0
            },
            15000
        )

        // Page still alive after translation
        const alive = await client.evaluate('document.querySelector("textarea") !== null') as boolean
        expect(alive).toBe(true)
    }, 30000)

    it('translates mixed language text via HTTP API', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('Hello 你好 goodbye 再见')

        await waitForSourceText('Hello 你好 goodbye 再见', 5000)

        const client = await getTranslateClient()
        await client.waitFor(
            async () => {
                const hasContent = await client.evaluate(`
                    (() => {
                        const cards = document.querySelectorAll('[data-result-key]')
                        for (const card of cards) {
                            const textareas = card.querySelectorAll('textarea')
                            for (const ta of textareas) {
                                if (ta.value && ta.value.length > 0) return true
                            }
                        }
                        return false
                    })()
                `) as boolean
                return hasContent
            },
            15000
        )

        const alive = await client.evaluate('document.querySelector("textarea") !== null') as boolean
        expect(alive).toBe(true)
    }, 30000)

    it('renders result card headers with service names', async () => {
        const client = await getTranslateClient()
        const headers = await client.evaluate(`
            Array.from(document.querySelectorAll('[data-result-key] span.text-xs.font-semibold'))
                .map(el => el.textContent)
        `) as string[]
        expect(headers.length).toBeGreaterThan(0)
        // Default services include bing, google, deepl
        const headerText = headers.join(' ').toLowerCase()
        expect(
            headerText.includes('bing') || headerText.includes('google') || headerText.includes('deepl')
        ).toBe(true)
    })

    it('allows re-translating after first translation', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('test retranslate')

        await waitForSourceText('test retranslate', 5000)
        const sourceValue = await getTextareaValue()
        expect(sourceValue).toBe('test retranslate')
    }, 20000)
})
