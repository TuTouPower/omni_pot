// Covers docs/issues.md:
//   - 翻译失败重试功能失效 (retry button must actually re-trigger translation)
//   - 翻译结果卡片折叠与加载动效 (card collapsed-by-default while loading,
//     shows in-progress indicator, auto-expands once result returns)
//
// Uses a local HTTP test server to control translation API responses.
// The app makes real HTTP requests to the local server — no page-level fetch mocking.

import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import type { TranslationTestServer } from '../fixtures/translation_test_server'

test.describe('@ui translate result card states', () => {
    test('retry button re-triggers translation after a failure (stubbed - local HTTP server)', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            // First request: return 500 error
            server.set_mymemory_response({ translated_text: '', status: 500 })

            await translate.typeSource('hello retry')
            await translate.clickTranslate()

            // First attempt fails -> error + retry button visible
            await expect(translate.resultError('mymemory@e2e')).toBeVisible({ timeout: 30_000 })
            await expect(translate.resultRetryButton('mymemory@e2e')).toBeVisible()

            // Second request: return success
            server.set_mymemory_response({ translated_text: 'retry success body', status: 200 })
            server.clear_requests()

            // Click retry -> error clears, body shows the success payload
            await translate.clickResultRetry('mymemory@e2e')
            await expect(translate.resultError('mymemory@e2e')).toHaveCount(0, { timeout: 30_000 })
            await expect.poll(
                async () => (await translate.getResultText('mymemory@e2e'))?.trim() ?? '',
                { timeout: 30_000 }
            ).toBe('retry success body')

            // Verify the retry actually sent a new HTTP request (not just a UI toggle)
            expect(server.request_count).toBeGreaterThanOrEqual(1)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('card stays collapsed with a loading indicator until the result arrives, then auto-expands', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            // Hold requests so the translation stays in "loading" state
            server.hold_requests()
            server.set_mymemory_response({ translated_text: 'eventually expanded body', status: 200 })

            await translate.typeSource('hello loading')
            await translate.clickTranslate()

            // Wait for the request to arrive at the server
            await expect.poll(() => Promise.resolve(server?.request_count ?? 0), { timeout: 30_000 }).toBeGreaterThanOrEqual(1)

            // While the request is in flight: card shows loading indicator,
            // the result body is collapsed (not visible), no error.
            await expect(translate.resultCard('mymemory@e2e')).toBeVisible()
            await expect(translate.resultCard('mymemory@e2e').getByTestId('result-loading'))
                .toBeVisible({ timeout: 5_000 })
            await expect(translate.resultBody('mymemory@e2e')).toBeHidden()
            await expect(translate.resultError('mymemory@e2e')).toHaveCount(0)

            // Release the response
            server.release_all()

            // Once the response arrives, the card auto-expands and the
            // loading indicator disappears.
            await expect(translate.resultBody('mymemory@e2e'))
                .toBeVisible({ timeout: 10_000 })
            await expect(translate.resultCard('mymemory@e2e').getByTestId('result-loading'))
                .toHaveCount(0)
            await expect.poll(
                async () => (await translate.getResultText('mymemory@e2e'))?.trim() ?? '',
                { timeout: 10_000 }
            ).toBe('eventually expanded body')
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })
})
