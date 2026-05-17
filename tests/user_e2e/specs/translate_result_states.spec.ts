// Covers docs/issues.md:
//   - 翻译失败重试功能失效 (retry button must actually re-trigger translation)
//   - 翻译结果卡片折叠与加载动效 (card collapsed-by-default while loading,
//     shows in-progress indicator, auto-expands once result returns)
//
// Both behaviours are user-visible result-card state transitions, so they live
// together. These tests use the Lingva instance because we can stub its HTTP
// reply without needing a real network round-trip.

import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const lingva_only_config = {
    translate_service_list: ['lingva@default'],
    service_instances: {
        'lingva@default': { serviceKey: 'lingva', config: {} },
    },
}

test.describe('@ui translate result card states', () => {
    test('retry button re-triggers translation after a failure', async () => {
        const omni = await AppFixture.start({ config: lingva_only_config })
        try {
            const translate = await omni.translate()
            await translate.fail_then_succeed_lingva_translation_once('retry success body')

            await translate.typeSource('hello retry')
            await translate.clickTranslate()

            // First attempt fails -> error + retry button visible
            await expect(translate.resultError('lingva@default')).toBeVisible({ timeout: 30_000 })
            await expect(translate.resultRetryButton('lingva@default')).toBeVisible()

            // Click retry -> error clears, body shows the success payload
            await translate.clickResultRetry('lingva@default')
            await expect(translate.resultError('lingva@default')).toHaveCount(0, { timeout: 30_000 })
            await expect.poll(
                async () => (await translate.getResultText('lingva@default'))?.trim() ?? '',
                { timeout: 30_000 }
            ).toBe('retry success body')
        } finally {
            await omni.stop()
        }
    })

    test('card stays collapsed with a loading indicator until the result arrives, then auto-expands', async () => {
        const omni = await AppFixture.start({ config: lingva_only_config })
        try {
            const translate = await omni.translate()
            const lingva = await translate.hold_lingva_translation_once('eventually expanded body')

            await translate.typeSource('hello loading')
            await translate.clickTranslate()

            // While the request is in flight: card shows loading indicator,
            // the result body is collapsed (not visible), no error.
            await lingva.wait_for_request()
            await expect(translate.resultCard('lingva@default')).toBeVisible()
            await expect(translate.resultCard('lingva@default').getByTestId('result-loading'))
                .toBeVisible({ timeout: 5_000 })
            await expect(translate.resultBody('lingva@default')).toBeHidden()
            await expect(translate.resultError('lingva@default')).toHaveCount(0)

            // Once the response is released, the card auto-expands and the
            // loading indicator disappears.
            lingva.release_response()
            await expect(translate.resultBody('lingva@default'))
                .toBeVisible({ timeout: 10_000 })
            await expect(translate.resultCard('lingva@default').getByTestId('result-loading'))
                .toHaveCount(0)
            await expect.poll(
                async () => (await translate.getResultText('lingva@default'))?.trim() ?? '',
                { timeout: 10_000 }
            ).toBe('eventually expanded body')
        } finally {
            await omni.stop()
        }
    })
})
