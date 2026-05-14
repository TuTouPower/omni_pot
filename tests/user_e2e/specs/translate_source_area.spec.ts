import { test, expect } from '../fixtures/test'

test.describe('@ui translate source area', () => {
    test('user can edit, normalize, copy, and clear source text', async ({ omni }) => {
        const translate = await omni.translate()

        await translate.typeSource('hello\nworld')
        await expect(translate.sourceInput()).toHaveValue('hello\nworld')

        await translate.clickDeleteNewline()
        await expect(translate.sourceInput()).toHaveValue('hello world')

        await translate.clickCopySource()
        await expect.poll(async () => (await omni.api.readClipboard()).text).toBe('hello world')

        await translate.clickClearSource()
        await expect(translate.sourceInput()).toHaveValue('')
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
