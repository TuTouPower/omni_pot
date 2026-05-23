import { test, expect } from '../fixtures/test'
import type { TranslatePage } from '../pages/translate_page'

async function expect_non_empty_result_body(translate: TranslatePage): Promise<void> {
    await expect.poll(async () => await translate.resultBodies().count(), { timeout: 15_000 }).toBeGreaterThan(0)
    await expect.poll(async () => {
        const bodies = translate.resultBodies()
        for (let i = 0; i < await bodies.count(); i += 1) {
            const text = await bodies.nth(i).textContent()
            if (text?.trim()) return true
        }
        return false
    }, { timeout: 15_000 }).toBe(true)
}

test.describe('@core translate core', () => {
    test.describe.configure({ retries: 2 })

    test('selection translate action fills source text and shows a stubbed result body', async ({ omni }) => {
        const server = await omni.startTranslationTestServer()
        server.set_mymemory_response({ translated_text: '你好世界', status: 200 })

        try {
            const translate = await omni.translate()
            const result = await omni.api.triggerSelection('hello world')

            expect(result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue('hello world', { timeout: 10_000 })
            await expect_non_empty_result_body(translate)
        } finally {
            await server.stop()
        }
    })

    test('clipboard translate action fills source text and shows a stubbed result body', async ({ omni }) => {
        const server = await omni.startTranslationTestServer()
        server.set_mymemory_response({ translated_text: '早上好', status: 200 })

        try {
            const translate = await omni.translate()
            const result = await omni.api.triggerClipboardTranslate('good morning')

            expect(result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue('good morning', { timeout: 10_000 })
            await expect_non_empty_result_body(translate)
        } finally {
            await server.stop()
        }
    })
})
