import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { init, cleanup, getTranslateClient, waitForSourceText, waitForSelector } from './helpers/test_utils'
import { ensureBuilt, startElectron, stopElectron, type ElectronInstance } from './helpers/electron_launcher'

describe('Critical Path 4: OCR 翻译全流程', () => {
    let instance: ElectronInstance

    beforeAll(async () => {
        await ensureBuilt()
        instance = await startElectron()
        init(instance.translateClient, instance.httpPort)
        await waitForSelector('textarea', 15000)
    }, 60000)

    afterAll(async () => {
        cleanup()
        await stopElectron(instance)
    })

    it('receives OCR text in translate window via send-to-translate', async () => {
        const client = await getTranslateClient()

        // Simulate: OCR produced text, now send to translate window
        await client.evaluate(`
            window.electronAPI.ocr.sendToTranslate('This is OCR recognized text')
        `)

        // Wait for source text to appear
        await waitForSourceText('This is OCR recognized text', 5000)

        const sourceValue = await client.evaluate(
            'document.querySelector("textarea").value'
        ) as string
        expect(sourceValue).toBe('This is OCR recognized text')
    }, 15000)

    it('translates OCR text and shows results', async () => {
        const client = await getTranslateClient()

        // Wait for at least one result card to have content
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
                            // Also check for error or dict results
                            const p = card.querySelectorAll('p')
                            for (const el of p) {
                                if (el.textContent && el.textContent.length > 0) return true
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
    }, 25000)

    it('can send Chinese OCR text to translate window', async () => {
        const client = await getTranslateClient()

        await client.evaluate(`
            window.electronAPI.ocr.sendToTranslate('你好世界，这是OCR识别的中文文本')
        `)

        await waitForSourceText('你好世界，这是OCR识别的中文文本', 5000)

        const sourceValue = await client.evaluate(
            'document.querySelector("textarea").value'
        ) as string
        expect(sourceValue).toBe('你好世界，这是OCR识别的中文文本')
    }, 15000)

    it('translate window stays alive after OCR translate pipeline', async () => {
        const client = await getTranslateClient()

        // Wait for translation to settle
        await new Promise(r => setTimeout(r, 3000))

        const alive = await client.evaluate('document.querySelector("textarea") !== null') as boolean
        expect(alive).toBe(true)

        // Can still type and translate manually
        await client.evaluate('document.querySelector("textarea").value = ""')
        await client.evaluate('document.querySelector("textarea").focus()')
        await client.insertText('manual input after OCR')
        const value = await client.evaluate(
            'document.querySelector("textarea").value'
        ) as string
        expect(value).toBe('manual input after OCR')
    }, 20000)
})
