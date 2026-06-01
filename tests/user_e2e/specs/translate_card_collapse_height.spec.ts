import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import type { TranslationTestServer } from '../fixtures/translation_test_server'
import { local_translation_timeout_ms, ui_timeout_ms } from '../fixtures/timeout_constants'

const HEIGHT_TOLERANCE_PX = 12

function long_translation(line_count: number): string {
    return Array.from({ length: line_count }, (_, index) => `collapse height body line ${String(index + 1)}`).join('\n')
}

test.describe('@ui translate card collapse affects window height', () => {
    test.describe.configure({ retries: 2 })

    test('collapsing a result card reduces window height', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            server.set_mymemory_response({ translated_text: long_translation(15), status: 200 })
            await translate.typeSource('hello collapse height')
            await translate.clickTranslate()
            await translate.waitAllResults(local_translation_timeout_ms)

            // Wait for height to stabilise
            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeGreaterThan(100)
            const initial_height = (await omni.api.windowState('translate')).bounds?.height ?? 0

            await translate.clickResultCollapse('mymemory@e2e')
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'false')

            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeLessThan(initial_height - HEIGHT_TOLERANCE_PX)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('expanding a collapsed card restores window height', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            server.set_mymemory_response({ translated_text: long_translation(15), status: 200 })
            await translate.typeSource('hello expand height')
            await translate.clickTranslate()
            await translate.waitAllResults(local_translation_timeout_ms)

            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeGreaterThan(100)
            const initial_height = (await omni.api.windowState('translate')).bounds?.height ?? 0

            await translate.clickResultCollapse('mymemory@e2e')
            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeLessThan(initial_height - HEIGHT_TOLERANCE_PX)
            const collapsed_height = (await omni.api.windowState('translate')).bounds?.height ?? 0

            await translate.clickResultCollapse('mymemory@e2e')
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'true')

            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeGreaterThan(collapsed_height + HEIGHT_TOLERANCE_PX)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('collapsing all cards shrinks window close to initial height', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            server.set_mymemory_response({ translated_text: long_translation(15), status: 200 })
            await translate.typeSource('hello all collapse')
            await translate.clickTranslate()
            await translate.waitAllResults(local_translation_timeout_ms)

            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeGreaterThan(200)

            await translate.clickResultCollapse('mymemory@e2e')
            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeLessThanOrEqual(260)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('manual collapse resets on new translation and height grows back', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            server.set_mymemory_response({ translated_text: long_translation(15), status: 200 })
            await translate.typeSource('first request')
            await translate.clickTranslate()
            await translate.waitAllResults(local_translation_timeout_ms)

            // Wait for initial height to stabilise
            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeGreaterThan(100)
            const initial_height = (await omni.api.windowState('translate')).bounds?.height ?? 0

            // Collapse
            await translate.clickResultCollapse('mymemory@e2e')
            await expect(translate.resultAction('mymemory@e2e', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'false')
            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeLessThan(initial_height - HEIGHT_TOLERANCE_PX)
            const collapsed_height = (await omni.api.windowState('translate')).bounds?.height ?? 0

            // New translation — card should auto-expand
            server.set_mymemory_response({ translated_text: long_translation(15), status: 200 })
            await translate.typeSource('second request')
            await translate.clickTranslate()
            await translate.waitAllResults(local_translation_timeout_ms)

            await expect(translate.resultAction('mymemory@e2e', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'true')

            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeGreaterThan(collapsed_height + HEIGHT_TOLERANCE_PX)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('multiple services: collapsing one card gives intermediate height', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer(['mymemory@e2e_a', 'mymemory@e2e_b'])
            const translate = await omni.translate()

            server.set_mymemory_response({ translated_text: long_translation(15), status: 200 }, 'mymemory@e2e_a')
            server.set_mymemory_response({ translated_text: long_translation(15), status: 200 }, 'mymemory@e2e_b')
            await translate.typeSource('hello multi collapse')
            await translate.clickTranslate()
            await translate.waitAllResults(local_translation_timeout_ms)

            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeGreaterThan(200)
            const full_height = (await omni.api.windowState('translate')).bounds?.height ?? 0

            // Collapse only the second card
            await translate.clickResultCollapse('mymemory@e2e_b')
            await expect(translate.resultAction('mymemory@e2e_b', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'false')
            // First card should stay expanded
            await expect(translate.resultAction('mymemory@e2e_a', 'result-collapse'))
                .toHaveAttribute('aria-expanded', 'true')

            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeLessThan(full_height - HEIGHT_TOLERANCE_PX)
            const partial_height = (await omni.api.windowState('translate')).bounds?.height ?? 0

            // Collapse the first card too — now both collapsed
            await translate.clickResultCollapse('mymemory@e2e_a')
            await expect.poll(
                async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: ui_timeout_ms },
            ).toBeLessThan(partial_height - HEIGHT_TOLERANCE_PX)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })
})
