import { local_operation_timeout_ms } from '../fixtures/timeout_constants'
// Covers docs/issues.md "词典卡片内容展示不全":
//   - Dictionary cards do not impose a fixed max-height. The card grows to fit
//     all definitions and examples; only the outer window scrolls when the
//     combined content exceeds the viewport.
//
// We render a word with many definitions/examples (cambridge_dict "run" is a
// classic many-sense entry) and assert:
//   1. Every rendered definition is laid out within the card box (no clipping).
//   2. The card itself has no `max-height` style or it is set to `none`.

import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import { build_cambridge_dict_init_script, cambridge_dict_run_payload } from '../fixtures/stub_payloads'

async function wait_for_dict_card(page: Page): Promise<void> {
    // Wait for at least one result card with definitions rendered
    await expect(page.locator('[data-testid="dict-card"]').first()).toBeVisible({ timeout: local_operation_timeout_ms })
    await expect(page.locator('[data-testid="dict-definition"]').first()).toBeVisible({ timeout: local_operation_timeout_ms })
}

test.describe('@ui dict card height auto-fits content', () => {
    test.describe.configure({ retries: 2 })

    test('all definitions for a many-sense word render inside the card without clipping', async () => {
        const omni = await AppFixture.start({
            init_script: build_cambridge_dict_init_script({ run: cambridge_dict_run_payload }),
            config: {
                dictionary_service_list: [],
                english_dictionary_service_list: ['cambridge_dict@default'],
                service_instances: {
                    'cambridge_dict@default': { serviceKey: 'cambridge_dict', config: {} },
                },
            },
        })

        try {
            await omni.api.triggerDict('run')
            const dict = await omni.dict()
            const page = dict['page']
            await wait_for_dict_card(page)

            // Result card containing definitions (dict-definition elements inside).
            const definitions_card = page.locator('[data-testid="dict-card"]').last()
            const definitions = definitions_card.locator('[data-testid="dict-definition"]')

            // The local cambridge_dict stub is expected to return definitions for "run".
            const count = await definitions.count()
            expect(count, 'cambridge_dict stub should return definitions for "run"').toBeGreaterThanOrEqual(1)

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
