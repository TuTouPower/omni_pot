// Covers docs/issues.md:
//   - 翻译窗口垂直拉伸限制缺失 (max-height = content height, min-height = first
//     result card fully visible)
//   - 翻译窗口最小宽度限制不准确 (min-width must show the full language switch
//     row: source-lang -> swap -> target-lang)
//
// The test resizes the window programmatically and checks that the OS-applied
// bounds respect the constraints. Because window manager DPI rounding can shift
// the result by a few px we allow a small tolerance.
// Card height tests use a local HTTP test server instead of page-level fetch stubs.

import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import { TranslationTestServer } from '../fixtures/translation_test_server'

const RESIZE_TOLERANCE_PX = 4

const lingva_only_config = {
    translate_service_list: ['lingva@default'],
    service_instances: {
        'lingva@default': { serviceKey: 'lingva', config: {} },
    },
}

test.describe('@ui translate window constraints', () => {
    test('max height covers 3 cards × 8 lines of body text', async () => {
        // Spec: maxHeight (960) must be tall enough to render 3 stacked result
        // cards each holding 8 lines of body text. Line-height is 22px in the
        // shared card body styles, so 3 × (8 × 22 + chrome) ≈ 600 px of pure
        // body content. We assert maxHeight ≥ that floor.
        const omni = await AppFixture.start({ config: lingva_only_config })
        try {
            await omni.translate()
            // Stretch absurdly tall — the OS-clamped resulting height tells us
            // the configured maxHeight.
            const target_height = 4000
            const result = await omni.api.windowState('translate')
            if (!result.bounds) throw new Error('missing translate bounds')
            await new Promise((r) => setTimeout(r, 200))
            await omni.api.windowState('translate')
            // Use the translate page helper to resize, then read back actual height.
            const translate = await omni.translate()
            await translate.resizeWindowTo(result.bounds.width, target_height)
            await expect.poll(async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: 5_000 }).toBeLessThan(target_height)
            const max_observed = (await omni.api.windowState('translate')).bounds?.height ?? 0
            const min_required = 3 * 8 * 22  // 3 cards × 8 lines × 22px line-height
            expect(max_observed, 'maxHeight must accommodate 3×8 lines of body text').toBeGreaterThanOrEqual(min_required)
        } finally {
            await omni.stop()
        }
    })

    test('window cannot stretch taller than content card stack', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            server.set_lingva_response({ translation: 'constraint height body', status: 200 })
            await translate.typeSource('hello height')
            await translate.clickTranslate()
            await translate.waitAllResults(30_000)

            // Try to stretch the window absurdly tall.
            await translate.resizeWindowTo(430, 2000)
            await expect.poll(async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: 5_000, intervals: [100, 200, 400] }).toBeLessThanOrEqual(2000)

            const final_bounds = (await omni.api.windowState('translate')).bounds
            if (!final_bounds) throw new Error('missing translate window bounds')

            // Measure the actual rendered content stack height (sum of cards).
            const content_height = await translate.titlebar().evaluate(() => {
                const cards = Array.from(document.querySelectorAll<HTMLElement>('.card'))
                if (cards.length === 0) return 0
                const top = Math.min(...cards.map(c => c.getBoundingClientRect().top))
                const bottom = Math.max(...cards.map(c => c.getBoundingClientRect().bottom))
                return bottom - top
            })

            // Window height should be near content + chrome; absolutely not 2000.
            expect(final_bounds.height).toBeLessThan(content_height + 200)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('window cannot shrink below first-result-card height', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            server.set_lingva_response({ translation: 'min height body', status: 200 })
            await translate.typeSource('hi')
            await translate.clickTranslate()
            await translate.waitAllResults(30_000)

            await translate.resizeWindowTo(430, 50)
            await expect.poll(async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: 5_000 }).toBeGreaterThan(100)

            const final_bounds = (await omni.api.windowState('translate')).bounds
            expect(final_bounds).not.toBeNull()

            // The first result card must still be fully visible in the viewport.
            const first_card_visible = await translate.resultCard('lingva@e2e').isVisible()
            expect(first_card_visible).toBe(true)
            const card_box = await translate.resultCard('lingva@e2e').boundingBox()
            const viewport = translate['page'].viewportSize() ?? { width: 0, height: 0 }
            if (card_box) {
                expect(card_box.y + card_box.height).toBeLessThanOrEqual(viewport.height + RESIZE_TOLERANCE_PX)
            }
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('window cannot shrink narrower than language switch row', async () => {
        const omni = await AppFixture.start({ config: lingva_only_config })
        try {
            const translate = await omni.translate()
            await translate.ensureSourceVisible()

            // Compute the natural width of the source -> swap -> target row.
            const lang_row_width = await translate.sourceLanguageButton().evaluate((source_el) => {
                const swap = document.querySelector('[data-testid="lang-swap"]')
                const target = document.querySelector('[data-testid="lang-target-button"]')
                if (!swap || !target) return 0
                const left = (source_el as HTMLElement).getBoundingClientRect().left
                const right = (target as HTMLElement).getBoundingClientRect().right
                return right - left
            })
            expect(lang_row_width).toBeGreaterThan(0)

            await translate.resizeWindowTo(120, 400)
            await expect.poll(async () => (await omni.api.windowState('translate')).bounds?.width ?? 0,
                { timeout: 5_000 }).toBeGreaterThanOrEqual(lang_row_width - RESIZE_TOLERANCE_PX)

            // All three language-row elements must remain visible.
            await expect(translate.sourceLanguageButton()).toBeVisible()
            await expect(translate.targetLanguageButton()).toBeVisible()
            await expect(translate['page'].getByTestId('lang-swap')).toBeVisible()
        } finally {
            await omni.stop()
        }
    })
})
