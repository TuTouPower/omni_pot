// Covers docs/issues.md "词典卡片内容展示不全":
//   - Dictionary cards do not impose a fixed max-height. The card grows to fit
//     all definitions and examples; only the outer window scrolls when the
//     combined content exceeds the viewport.
//
// We render a word with many definitions/examples (free_dictionary "run" is a
// classic many-sense entry) and assert:
//   1. Every rendered definition is laid out within the card box (no clipping).
//   2. The card itself has no `max-height` style or it is set to `none`.

import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import { build_free_dictionary_init_script, free_dictionary_run_payload } from '../fixtures/stub_payloads'

async function wait_for_dict_card(page: Page): Promise<void> {
    // At least 2 cards: source card + result card (pronunciation card may also appear)
    await expect(page.locator('[data-testid="dict-card"]')).toHaveCount(2, { timeout: 60_000 })
    // Wait for definitions to actually render inside the result card
    await expect(page.locator('[data-testid="dict-definition"]').first()).toBeVisible({ timeout: 60_000 })
}

test.describe('@ui dict card height auto-fits content', () => {
    test.describe.configure({ retries: 2 })

    test('all definitions for a many-sense word render inside the card without clipping', async () => {
        const omni = await AppFixture.start({
            init_script: build_free_dictionary_init_script({ run: free_dictionary_run_payload }),
            config: {
                dictionary_service_list: [],
                english_dictionary_service_list: ['free_dictionary@default'],
                service_instances: {
                    'free_dictionary@default': { serviceKey: 'free_dictionary', config: {} },
                },
            },
        })

        try {
            await omni.api.triggerDict('run')
            const dict = await omni.dict()
            const page = dict['page']
            await wait_for_dict_card(page)

            // Result card is the last card (after source card and optional pronunciation card).
            const card_count = await page.locator('[data-testid="dict-card"]').count()
            const definitions_card = page.locator('[data-testid="dict-card"]').nth(card_count - 1)
            const definitions = definitions_card.locator('[data-testid="dict-definition"]')

            // The local free_dictionary stub returns multiple senses for "run".
            const count = await definitions.count()
            expect(count, 'free_dictionary stub should return multiple senses for "run"').toBeGreaterThanOrEqual(3)

            const card_box = await definitions_card.boundingBox()
            if (!card_box) throw new Error('missing definitions card box')

            // None of the rendered definitions may overflow the card vertically.
            for (let i = 0; i < count; i += 1) {
                const def_box = await definitions.nth(i).boundingBox()
                if (!def_box) throw new Error(`missing definition box at ${String(i)}`)
                expect(def_box.y + def_box.height,
                    `definition #${String(i)} is clipped by the card`)
                    .toBeLessThanOrEqual(card_box.y + card_box.height + 2)
            }

            // The card must not impose a fixed max-height that would truncate content.
            const max_heights = await page.locator('[data-testid="dict-card"]').evaluateAll(
                (cards) => cards.map((card) => window.getComputedStyle(card).maxHeight),
            )
            for (const max_height of max_heights) {
                expect(['none', '', 'auto'], `dict-card has a clipping max-height: ${max_height}`).toContain(max_height)
            }
        } finally {
            await omni.stop()
        }
    })
})
