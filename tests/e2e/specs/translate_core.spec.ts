import { test, expect } from '../fixtures/test'
import type { TranslatePage } from '../pages/translate_page'
import { local_operation_timeout_ms, local_translation_timeout_ms } from '../fixtures/timeout_constants'

async function expect_non_empty_result_body(translate: TranslatePage): Promise<void> {
    await expect.poll(async () => await translate.resultBodies().count(), { timeout: local_translation_timeout_ms }).toBeGreaterThan(0)
    await expect.poll(async () => {
        const bodies = translate.resultBodies()
        for (let i = 0; i < await bodies.count(); i += 1) {
            const text = await bodies.nth(i).textContent()
            if (text?.trim()) return true
        }
        return false
    }, { timeout: local_translation_timeout_ms }).toBe(true)
}

test.describe('translate flows', () => {
    test.describe.configure({ retries: 2 })

    test('@core user starts the app, sees translate window, receives a stubbed result, and closes the window', async ({ omni }) => {
        const server = await omni.startTranslationTestServer()
        server.set_mymemory_response({ translated_text: '你好世界', status: 200 })

        try {
            const translate = await omni.translate()
            await expect.poll(async () => (await omni.api.windowState('translate')).visible).toBe(true)
            const result = await omni.api.triggerSelection('hello world')

            expect(result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue('hello world', { timeout: local_operation_timeout_ms })
            await expect_non_empty_result_body(translate)
            await translate.clickClose()
            await expect.poll(async () => (await omni.api.windowState('translate')).visible).toBe(false)
        } finally {
            await server.stop()
        }
    })

    test('@ui clipboard translate action fills source text and shows a stubbed result body', async ({ omni }) => {
        const server = await omni.startTranslationTestServer()
        server.set_mymemory_response({ translated_text: '早上好', status: 200 })

        try {
            const translate = await omni.translate()
            const result = await omni.api.triggerClipboardTranslate('good morning')

            expect(result.success).toBe(true)
            await expect(translate.sourceInput()).toHaveValue('good morning', { timeout: local_operation_timeout_ms })
            await expect_non_empty_result_body(translate)
        } finally {
            await server.stop()
        }
    })
})
