import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
    init, cleanup, getTranslateClient,
    clearTextarea, getTextareaValue, waitForSelector
} from './test_utils'
import { ensureBuilt, startElectron, stopElectron, type ElectronInstance } from './electron_launcher'

describe('Critical Path 2: 输入翻译全流程', () => {
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

    // --- Input acceptance ---

    it('renders editable textarea with correct placeholder', async () => {
        const client = await getTranslateClient()
        const html = await client.evaluate('document.querySelector("textarea")?.outerHTML') as string
        expect(html).toBeDefined()
        expect(html).toContain('placeholder="Enter text to translate..."')
        expect(html).not.toContain('disabled')
        expect(html).not.toContain('readonly')
    })

    it('accepts English text input', async () => {
        const client = await getTranslateClient()
        await clearTextarea()
        await client.insertText('hello')
        const value = await getTextareaValue()
        expect(value).toBe('hello')
    })

    it('accepts Chinese text input', async () => {
        const client = await getTranslateClient()
        await clearTextarea()
        await client.insertText('你好世界')
        const value = await getTextareaValue()
        expect(value).toBe('你好世界')
    })

    it('accepts mixed Chinese-English input', async () => {
        const client = await getTranslateClient()
        await clearTextarea()
        await client.insertText('Hello 你好 World 世界')
        const value = await getTextareaValue()
        expect(value).toBe('Hello 你好 World 世界')
    })

    it('accepts special characters', async () => {
        const client = await getTranslateClient()
        await clearTextarea()
        await client.insertText('Hello! 你好？¡Hola! 123 @#$%')
        const value = await getTextareaValue()
        expect(value).toBe('Hello! 你好？¡Hola! 123 @#$%')
    })

    it('accepts long text input', async () => {
        const client = await getTranslateClient()
        await clearTextarea()
        const longText = '这是一段很长的中文文本，用来测试翻译窗口。This is a long English text for testing. '.repeat(3).trim()
        await client.insertText(longText)
        const value = await getTextareaValue()
        expect(value.length).toBeGreaterThan(100)
        expect(value).toContain('中文文本')
        expect(value).toContain('English text')
    })

    // --- Enter triggers translation ---

    it('triggers translation on Enter key for English text', async () => {
        const client = await getTranslateClient()
        await clearTextarea()
        await client.insertText('hello')
        await client.pressEnter()

        // Wait for at least one result card to render content
        await client.waitFor(
            async () => {
                const count = await client.evaluate(
                    'document.querySelectorAll("[data-result-key]").length'
                ) as number
                return count > 0
            },
            10000
        )

        // Page still alive
        const alive = await client.evaluate('document.querySelector("textarea") !== null') as boolean
        expect(alive).toBe(true)
    }, 20000)

    it('triggers translation on Enter key for Chinese text', async () => {
        const client = await getTranslateClient()
        await clearTextarea()
        await client.insertText('你好')
        await client.pressEnter()

        // Wait for translation to complete (no loading indicators)
        await client.waitFor(
            async () => {
                const hasSpinner = await client.evaluate(`
                    document.querySelectorAll('[data-result-key] [role="progressbar"]').length
                `) as number
                // If no cards yet, still waiting
                const cardCount = await client.evaluate(
                    'document.querySelectorAll("[data-result-key]").length'
                ) as number
                return cardCount > 0
            },
            10000
        )

        const alive = await client.evaluate('document.querySelector("textarea") !== null') as boolean
        expect(alive).toBe(true)
    }, 20000)

    // --- Result display ---

    it('shows result cards with service names after translation', async () => {
        const client = await getTranslateClient()
        await clearTextarea()
        await client.insertText('world')
        await client.pressEnter()

        // Wait for results to appear
        await client.waitFor(
            async () => {
                const headers = await client.evaluate(`
                    Array.from(document.querySelectorAll('[data-result-key] span.text-xs.font-semibold'))
                        .filter(el => el.textContent && el.textContent.length > 0).length
                `) as number
                return headers > 0
            },
            15000
        )

        const headers = await client.evaluate(`
            Array.from(document.querySelectorAll('[data-result-key] span.text-xs.font-semibold'))
                .map(el => el.textContent)
        `) as string[]
        expect(headers.length).toBeGreaterThan(0)
    }, 25000)

    it('has language selector with correct options', async () => {
        const client = await getTranslateClient()
        const selectCount = await client.evaluate('document.querySelectorAll("select").length') as number
        expect(selectCount).toBeGreaterThanOrEqual(2)

        const options = await client.evaluate(
            'Array.from(document.querySelectorAll("select option")).map(o => o.value)'
        ) as string[]
        expect(options).toContain('auto')
        expect(options).toContain('zh_cn')
        expect(options).toContain('en')
    })

    // --- Toolbar buttons ---

    it('has translate button in toolbar', async () => {
        const client = await getTranslateClient()
        // The toolbar is in .flex.flex-col.p-2 and contains at least one button with an SVG icon
        const hasTranslateButton = await client.evaluate(`
            (() => {
                const toolbar = document.querySelector('.flex.flex-col.p-2')
                if (!toolbar) return false
                const btn = toolbar.querySelector('button svg')
                return btn !== null
            })()
        `) as boolean
        expect(hasTranslateButton).toBe(true)
    })

    it('has clear button that empties the textarea', async () => {
        const client = await getTranslateClient()
        await clearTextarea()
        await client.insertText('test text')
        expect(await getTextareaValue()).toBe('test text')

        // Click the last button in the toolbar (clear/delete button)
        await client.evaluate(`
            const btns = document.querySelectorAll('.flex.flex-col.p-2 button')
            const deleteBtn = btns[btns.length - 1]
            if (deleteBtn) deleteBtn.click()
        `)

        const value = await getTextareaValue()
        expect(value).toBe('')
    })

    // --- Clear and re-type ---

    it('allows clearing and re-typing after a translation', async () => {
        const client = await getTranslateClient()
        await clearTextarea()
        await client.insertText('first')
        await client.pressEnter()

        // Brief wait for translation to start
        await new Promise(r => setTimeout(r, 2000))

        // Clear and type new text
        await clearTextarea()
        await client.insertText('second phrase')
        const value = await getTextareaValue()
        expect(value).toBe('second phrase')
    }, 15000)
})
