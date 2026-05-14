import { test, expect } from '../fixtures/test'

test.describe('@core translate core', () => {
    test('selection translate action fills source text and shows a real result body', async ({ omni }) => {
        const translate = await omni.translate()
        const result = await omni.api.triggerSelection('hello world')

        expect(result.success).toBe(true)
        await expect(translate.sourceInput()).toHaveValue('hello world', { timeout: 10_000 })
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

    test('clipboard translate action fills source text and shows a real result body', async ({ omni }) => {
        const translate = await omni.translate()
        const result = await omni.api.triggerClipboardTranslate('good morning')

        expect(result.success).toBe(true)
        await expect(translate.sourceInput()).toHaveValue('good morning', { timeout: 10_000 })
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
