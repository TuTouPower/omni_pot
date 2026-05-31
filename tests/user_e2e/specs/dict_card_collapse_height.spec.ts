import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import { build_cambridge_dict_init_script, cambridge_dict_run_payload } from '../fixtures/stub_payloads'
import { ocr_timeout_ms, ui_timeout_ms } from '../fixtures/timeout_constants'

const cambridge_dict_config = {
    welcome_dismissed: true,
    dictionary_service_list: [],
    english_dictionary_service_list: ['cambridge_dict@default'],
    service_instances: {
        'cambridge_dict@default': { serviceKey: 'cambridge_dict', config: {} },
    },
}

test.describe('@ui dict window height responds to card collapse', () => {
    test.describe.configure({ retries: 2 })

    test('collapsing a result card reduces window height', async () => {
        const omni = await AppFixture.start({
            init_script: build_cambridge_dict_init_script({ run: cambridge_dict_run_payload }),
            config: cambridge_dict_config,
        })

        try {
            await omni.api.triggerDict('run')
            const dict = await omni.dict()

            // Wait for result cards to render
            await dict.waitForCards(2, ocr_timeout_ms)
            await expect(dict.definitions().first()).toBeVisible({ timeout: ocr_timeout_ms })

            // Get the initial window height after content has settled
            const initial_bounds = await expect.poll(
                async () => {
                    const state = await omni.api.windowState('dict')
                    expect(state.bounds).not.toBeNull()
                    return state.bounds!
                },
                { timeout: ui_timeout_ms },
            )
            const initial_height = initial_bounds.height
            expect(initial_height).toBeGreaterThan(100)

            // Collapse the last result card (has a collapse button)
            const btn_count = await dict.collapseButtons().count()
            expect(btn_count, 'should have at least one collapse button').toBeGreaterThanOrEqual(1)

            await dict.clickCollapseByIndex(btn_count - 1)

            // After collapse, the window height should shrink
            await expect.poll(
                async () => (await omni.api.windowState('dict')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeLessThan(initial_height)
        } finally {
            await omni.stop()
        }
    })

    test('expanding a collapsed card restores window height', async () => {
        const omni = await AppFixture.start({
            init_script: build_cambridge_dict_init_script({ run: cambridge_dict_run_payload }),
            config: cambridge_dict_config,
        })

        try {
            await omni.api.triggerDict('run')
            const dict = await omni.dict()

            await dict.waitForCards(2, ocr_timeout_ms)
            await expect(dict.definitions().first()).toBeVisible({ timeout: ocr_timeout_ms })

            // Collapse the last result card
            const btn_count = await dict.collapseButtons().count()
            await dict.clickCollapseByIndex(btn_count - 1)

            // Wait for collapse to settle
            const collapsed_height = await expect.poll(
                async () => (await omni.api.windowState('dict')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            )
            expect(collapsed_height).toBeGreaterThan(100)

            // Expand the card back
            await dict.clickCollapseByIndex(btn_count - 1)

            // Height should grow back
            await expect.poll(
                async () => (await omni.api.windowState('dict')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeGreaterThan(collapsed_height)
        } finally {
            await omni.stop()
        }
    })
})
