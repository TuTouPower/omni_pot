import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import type { TranslationTestServer } from '../fixtures/translation_test_server'

const RESIZE_TOLERANCE_PX = 4
const HEIGHT_TOLERANCE_PX = 12

const single_service_config = {
    translate_service_list: ['mymemory@default'],
    service_instances: {
        'mymemory@default': { serviceKey: 'mymemory', config: {} },
    },
    welcome_dismissed: true,
}

function long_translation(line_count: number): string {
    return Array.from({ length: line_count }, (_, index) => `constraint height body line ${String(index + 1)}`).join('\n')
}

async function max_translate_height(omni: AppFixture): Promise<number> {
    const display = await omni.api.primaryDisplay()
    return Math.floor(display.workArea.height * 0.75)
}

test.describe('@ui translate window constraints', () => {
    test('max height covers 3 cards × 8 lines of body text', async () => {
        const min_required = 3 * 8 * 22
        const omni = await AppFixture.start({ config: single_service_config })
        try {
            expect(await max_translate_height(omni), '75vh max height must accommodate 3×8 body lines').toBeGreaterThanOrEqual(min_required)
        } finally {
            await omni.stop()
        }
    })

    test('window cannot stretch taller than translated content or 75vh cap', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            server.set_mymemory_response({ translated_text: 'constraint height body', status: 200 })
            await translate.typeSource('hello height')
            await translate.clickTranslate()
            await translate.waitAllResults(30_000)

            const content_height = await translate.page.evaluate(() => document.body.scrollHeight)
            await translate.resizeWindowTo(430, 2000)

            const final_bounds = (await omni.api.windowState('translate')).bounds
            if (!final_bounds) throw new Error('missing translate window bounds')
            expect(final_bounds.height).toBeLessThan(2000)
            expect(final_bounds.height).toBeLessThanOrEqual(await max_translate_height(omni) + RESIZE_TOLERANCE_PX)
            expect(final_bounds.height).toBeLessThanOrEqual(content_height + HEIGHT_TOLERANCE_PX)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('long results clamp to 75vh and scroll only the results area', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()

            server.set_mymemory_response({ translated_text: long_translation(120), status: 200 })
            await translate.typeSource('hello long height')
            await translate.clickTranslate()
            await translate.waitAllResults(30_000)

            const max_height = await max_translate_height(omni)
            await expect.poll(async () => (await omni.api.windowState('translate')).bounds?.height ?? 0, { timeout: 5_000 })
                .toBeLessThanOrEqual(max_height + RESIZE_TOLERANCE_PX)
            await expect.poll(async () => translate.resultsScroll().evaluate((el) => el.scrollHeight > el.clientHeight), { timeout: 5_000 })
                .toBe(true)
            await expect(translate.sourceInput()).toBeVisible()
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

            server.set_mymemory_response({ translated_text: 'min height body', status: 200 })
            await translate.typeSource('hi')
            await translate.clickTranslate()
            await translate.waitAllResults(30_000)

            await translate.resizeWindowTo(430, 50)
            await expect.poll(async () => (await omni.api.windowState('translate')).bounds?.height ?? 0,
                { timeout: 5_000 }).toBeGreaterThan(100)

            const first_card_visible = await translate.resultCard('mymemory@e2e').isVisible()
            expect(first_card_visible).toBe(true)
            const card_box = await translate.resultCard('mymemory@e2e').boundingBox()
            const viewport = translate.page.viewportSize() ?? { width: 0, height: 0 }
            if (card_box) {
                expect(card_box.y + card_box.height).toBeLessThanOrEqual(viewport.height + HEIGHT_TOLERANCE_PX)
            }
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('clearing source clears results and shrinks back to initial height', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()
            const initial_height = (await omni.api.windowState('translate')).bounds?.height ?? 0

            server.set_mymemory_response({ translated_text: long_translation(20), status: 200 })
            await translate.typeSource('hello clear height')
            await translate.clickTranslate()
            await translate.waitAllResults(30_000)
            await expect.poll(async () => (await omni.api.windowState('translate')).bounds?.height ?? 0, { timeout: 5_000 })
                .toBeGreaterThan(initial_height + HEIGHT_TOLERANCE_PX)

            await translate.clickClearSource()
            await expect(translate.resultCards()).toHaveCount(0)
            await expect.poll(async () => (await omni.api.windowState('translate')).bounds?.height ?? 0, { timeout: 5_000 })
                .toBeLessThanOrEqual(220)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('manual source deletion clears results and shrinks window', async () => {
        const omni = await AppFixture.start()
        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer()
            const translate = await omni.translate()
            const initial_height = (await omni.api.windowState('translate')).bounds?.height ?? 0

            server.set_mymemory_response({ translated_text: long_translation(20), status: 200 })
            await translate.typeSource('hello manual clear height')
            await translate.clickTranslate()
            await translate.waitAllResults(30_000)
            await expect.poll(async () => (await omni.api.windowState('translate')).bounds?.height ?? 0, { timeout: 5_000 })
                .toBeGreaterThan(initial_height + HEIGHT_TOLERANCE_PX)

            await translate.sourceInput().fill('')
            await expect(translate.resultCards()).toHaveCount(0)
            await expect.poll(async () => (await omni.api.windowState('translate')).bounds?.height ?? 0, { timeout: 5_000 })
                .toBeLessThanOrEqual(220)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('window cannot shrink narrower than language switch row', async () => {
        const omni = await AppFixture.start({ config: single_service_config })
        try {
            const translate = await omni.translate()

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

            await expect(translate.sourceLanguageButton()).toBeVisible()
            await expect(translate.targetLanguageButton()).toBeVisible()
            await expect(translate.page.getByTestId('lang-swap')).toBeVisible()
        } finally {
            await omni.stop()
        }
    })
})
