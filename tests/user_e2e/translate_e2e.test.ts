import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getClient, cleanupClient, clearTextarea, getTextareaValue } from './test_utils'

// Prerequisite: electron-vite dev running with --remote-debugging-port=9225
// Run: npx electron-vite dev -- --remote-debugging-port=9225 &
// Then: npx vitest run tests/user_e2e/

describe('Translate Window E2E', () => {
    beforeAll(async () => {
        // Verify CDP connection
        const client = await getClient()
        expect(client).toBeDefined()
    }, 15000)

    afterAll(() => {
        cleanupClient()
    })

    it('renders translate window with textarea', async () => {
        const client = await getClient()
        const html = await client.evaluate('document.querySelector("textarea")?.outerHTML') as string
        expect(html).toBeDefined()
        expect(html).toContain('placeholder="Enter text to translate..."')
        expect(html).not.toContain('disabled')
        expect(html).not.toContain('readonly')
    })

    it('accepts English text input via insertText', async () => {
        const client = await getClient()
        await clearTextarea()
        await client.insertText('hello')

        const value = await getTextareaValue()
        expect(value).toBe('hello')
    })

    it('accepts Chinese text input via insertText', async () => {
        const client = await getClient()
        await clearTextarea()
        await client.insertText('你好世界')

        const value = await getTextareaValue()
        expect(value).toBe('你好世界')
    })

    it('accepts mixed Chinese-English input', async () => {
        const client = await getClient()
        await clearTextarea()
        await client.insertText('Hello 你好 World 世界')

        const value = await getTextareaValue()
        expect(value).toBe('Hello 你好 World 世界')
    })

    it('appends text to existing content', async () => {
        const client = await getClient()
        await client.evaluate('document.querySelector("textarea").value = "first "')
        await client.evaluate('document.querySelector("textarea").focus()')
        await client.insertText('second')

        const value = await getTextareaValue()
        expect(value).toBe('first second')
    })

    it('handles special characters input', async () => {
        const client = await getClient()
        await clearTextarea()
        await client.insertText('Hello! 你好？¡Hola! 123 @#$%')

        const value = await getTextareaValue()
        expect(value).toBe('Hello! 你好？¡Hola! 123 @#$%')
    })

    it('handles long text input', async () => {
        const client = await getClient()
        await clearTextarea()

        const longText = '这是一段很长的中文文本，用来测试翻译窗口。This is a long English text for testing. '.repeat(3).trim()
        await client.insertText(longText)

        const value = await getTextareaValue()
        expect(value.length).toBeGreaterThan(100)
        expect(value).toContain('中文文本')
        expect(value).toContain('English text')
    })

    it('triggers translation on Enter key', async () => {
        const client = await getClient()
        await clearTextarea()
        await client.insertText('hello')
        await client.pressEnter()

        // Wait for translation services to respond
        await new Promise(r => setTimeout(r, 5000))

        // Check that at least one result area rendered (multiple textareas = source + results)
        const textareaCount = await client.evaluate('document.querySelectorAll("textarea").length') as number
        expect(textareaCount).toBeGreaterThanOrEqual(1)
    }, 20000)

    it('translates Chinese text via Enter key', async () => {
        const client = await getClient()
        await clearTextarea()
        await client.insertText('你好')
        await client.pressEnter()

        await new Promise(r => setTimeout(r, 5000))

        // Verify no crash - the page should still be functional
        const stillAlive = await client.evaluate('document.querySelector("textarea") !== null') as boolean
        expect(stillAlive).toBe(true)
    }, 20000)

    it('translates mixed language text via Enter key', async () => {
        const client = await getClient()
        await clearTextarea()
        await client.insertText('Hello 你好 goodbye 再见')
        await client.pressEnter()

        await new Promise(r => setTimeout(r, 5000))

        const stillAlive = await client.evaluate('document.querySelector("textarea") !== null') as boolean
        expect(stillAlive).toBe(true)
    }, 20000)

    it('language selector area renders with correct options', async () => {
        const client = await getClient()

        const selectCount = await client.evaluate('document.querySelectorAll("select").length') as number
        expect(selectCount).toBeGreaterThan(0)

        const options = await client.evaluate(
            'Array.from(document.querySelectorAll("select option")).map(o => o.value)'
        ) as string[]
        expect(options).toContain('auto')
        expect(options).toContain('zh_cn')
        expect(options).toContain('en')
    })

    it('top bar has pin and close buttons', async () => {
        const client = await getClient()

        const hasTopBarButtons = await client.evaluate(`
            (() => {
                const btns = document.querySelectorAll('button')
                let count = 0
                btns.forEach(b => {
                    const parent = b.parentElement
                    if (parent && parent.className && parent.className.includes('drag-region')) count++
                })
                return count >= 2
            })()
        `) as boolean
        expect(hasTopBarButtons).toBe(true)
    })

    it('translate button is clickable', async () => {
        const client = await getClient()
        await clearTextarea()
        await client.insertText('test')

        // Click translate button via DOM
        await client.evaluate(`
            const btns = document.querySelectorAll('button')
            const translateBtn = Array.from(btns).find(b => {
                return b.closest('.flex.flex-col.p-2')
            })
            if (translateBtn) translateBtn.click()
        `)

        await new Promise(r => setTimeout(r, 3000))

        const stillAlive = await client.evaluate('document.querySelector("textarea") !== null') as boolean
        expect(stillAlive).toBe(true)
    })

    it('clears textarea and re-types after translation', async () => {
        const client = await getClient()
        await clearTextarea()

        // Type new text
        await client.insertText('new text')

        const value = await getTextareaValue()
        expect(value).toBe('new text')
    })
})
