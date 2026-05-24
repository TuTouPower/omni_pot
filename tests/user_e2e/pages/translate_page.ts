import type { Page, Locator } from '@playwright/test'
import type { E2eApi } from '../fixtures/e2e_api'

function is_target_closed_error(error: unknown): boolean {
    return error instanceof Error && error.message.includes('Target page, context or browser has been closed')
}

export class TranslatePage {
    constructor(private page: Page, private api: E2eApi) {}

    wordmark(): Locator {
        return this.page.getByTestId('titlebar-wordmark')
    }

    titlebar(): Locator {
        return this.page.getByTestId('titlebar')
    }

    modeLabel(): Locator {
        return this.page.getByTestId('titlebar-mode')
    }

    pinButton(): Locator {
        return this.page.getByTestId('titlebar-pin')
    }

    topmostButton(): Locator {
        return this.page.getByTestId('titlebar-topmost')
    }

    closeButton(): Locator {
        return this.page.getByTestId('titlebar-close')
    }

    icon_width(locator: Locator): Promise<number> {
        return locator.locator('svg').evaluate((svg) => svg.getBoundingClientRect().width)
    }

    sourceInput(): Locator {
        return this.page.getByTestId('source-input')
    }

    welcomeEmpty(): Locator {
        return this.page.getByTestId('welcome-empty')
    }

    async ensureSourceVisible(): Promise<void> {
        if (await this.sourceInput().isVisible().catch(() => false)) return
        await this.api.triggerInputTranslate()
        await this.sourceInput().waitFor({ state: 'visible' })
    }

    translateButton(): Locator {
        return this.page.getByTestId('source-translate-btn')
    }

    sourceTtsButton(): Locator {
        return this.page.getByTestId('source-tts-btn')
    }

    clearSourceButton(): Locator {
        return this.page.getByTestId('source-clear-btn')
    }

    detectedLanguage(): Locator {
        return this.page.getByTestId('detected-lang')
    }

    sourceLanguage(): Locator {
        return this.page.getByTestId('lang-source')
    }

    sourceLanguageButton(): Locator {
        return this.page.getByTestId('lang-source-button')
    }

    targetLanguage(): Locator {
        return this.page.getByTestId('lang-target')
    }

    targetLanguageButton(): Locator {
        return this.page.getByTestId('lang-target-button')
    }

    resultBodies(): Locator {
        return this.page.getByTestId('result-body')
    }

    resultErrors(): Locator {
        return this.page.getByTestId('result-error')
    }

    // Titlebar
    clickPin(): Promise<void> {
        return this.page.getByTestId('titlebar-pin').click()
    }

    clickTopmost(): Promise<void> {
        return this.page.getByTestId('titlebar-topmost').click()
    }

    async clickClose(): Promise<void> {
        try {
            await this.page.getByTestId('titlebar-close').click()
        } catch (error) {
            if (!is_target_closed_error(error)) throw error
        }
    }

    getModeLabel(): Promise<string | null> {
        return this.page.getByTestId('titlebar-mode').textContent()
    }

    getWordmark(): Promise<string | null> {
        return this.page.getByTestId('titlebar-wordmark').textContent()
    }

    async isPinActive(): Promise<boolean> {
        const color = await this.page.getByTestId('titlebar-pin').evaluate(
            (el) => getComputedStyle(el).color
        )
        // brand primary color is not the mute color
        return !color.includes('var(--text-mute)')
    }

    async titlebarOrder(): Promise<string[]> {
        const items = [
            { name: 'pin', locator: this.pinButton() },
            { name: 'topmost', locator: this.topmostButton() },
            { name: 'wordmark', locator: this.wordmark() },
            { name: 'mode', locator: this.modeLabel() },
            { name: 'close', locator: this.closeButton() },
        ]
        const positions = await Promise.all(items.map(async (item) => {
            const box = await item.locator.boundingBox()
            return { name: item.name, x: box?.x ?? Number.POSITIVE_INFINITY }
        }))
        return positions.sort((a, b) => a.x - b.x).map((item) => item.name)
    }

    titlebarAppRegion(): Promise<string> {
        return this.titlebar().evaluate((el) => {
            return (getComputedStyle(el) as CSSStyleDeclaration & { webkitAppRegion?: string }).webkitAppRegion ?? ''
        })
    }

    pinButtonAppRegion(): Promise<string> {
        return this.pinButton().evaluate((el) => {
            return (getComputedStyle(el) as CSSStyleDeclaration & { webkitAppRegion?: string }).webkitAppRegion ?? ''
        })
    }

    topmostButtonAppRegion(): Promise<string> {
        return this.topmostButton().evaluate((el) => {
            return (getComputedStyle(el) as CSSStyleDeclaration & { webkitAppRegion?: string }).webkitAppRegion ?? ''
        })
    }

    closeButtonAppRegion(): Promise<string> {
        return this.closeButton().evaluate((el) => {
            return (getComputedStyle(el) as CSSStyleDeclaration & { webkitAppRegion?: string }).webkitAppRegion ?? ''
        })
    }

    async modeLabelHasPillBackground(): Promise<boolean> {
        return this.modeLabel().evaluate((el) => {
            const style = getComputedStyle(el)
            return style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.borderTopWidth !== '0px'
        })
    }

    // Source area
    async typeSource(text: string): Promise<void> {
        await this.ensureSourceVisible()
        await this.page.getByTestId('source-input').fill(text)
    }

    clickTranslate(): Promise<void> {
        return this.page.getByTestId('source-translate-btn').click()
    }

    clickClearSource(): Promise<void> {
        return this.page.getByTestId('source-clear-btn').click()
    }

    clickCopySource(): Promise<void> {
        return this.page.getByTestId('source-copy-btn').click()
    }

    clickDeleteNewline(): Promise<void> {
        return this.page.getByTestId('source-newline-btn').click()
    }

    clickDeleteSpace(): Promise<void> {
        return this.page.getByTestId('source-space-btn').click()
    }

    clickSourceTts(): Promise<void> {
        return this.page.getByTestId('source-tts-btn').click()
    }

    async click_source_tts_and_wait_for_audio_path(): Promise<string> {
        const request_promise = this.page.waitForRequest(
            (request) => request.url().includes('/api/v1/audio/'),
            { timeout: 10_000 }
        )
        await this.clickSourceTts()
        const request = await request_promise
        return new URL(request.url()).pathname
    }

    /** @stubbed Page-level fetch interceptor for Lingva. Prefer TranslationTestServer for new tests. */
    async hold_lingva_translation_once(translation: string): Promise<{ wait_for_request: () => Promise<void>; release_response: () => Promise<void> }> {
        await this.page.evaluate((translation_text: string) => {
            type E2eWindow = Window & {
                __e2e_lingva_request_seen?: boolean
                __e2e_lingva_release?: () => void
            }
            const e2e_window = window as E2eWindow
            const original_fetch = window.fetch.bind(window)
            let consumed = false
            const release_promise = new Promise<void>((resolve) => {
                e2e_window.__e2e_lingva_release = resolve
            })
            e2e_window.__e2e_lingva_request_seen = false
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
                if (!consumed && url.includes('/api/v1/') && !url.includes('/api/v1/audio/')) {
                    consumed = true
                    e2e_window.__e2e_lingva_request_seen = true
                    await release_promise
                    return new Response(JSON.stringify({ translation: translation_text }), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    })
                }
                return original_fetch(input, init)
            }
        }, translation)

        return {
            wait_for_request: async () => {
                await this.page.waitForFunction(() => {
                    return Boolean((window as Window & { __e2e_lingva_request_seen?: boolean }).__e2e_lingva_request_seen)
                }, undefined, { timeout: 10_000 })
            },
            release_response: () => this.page.evaluate(() => {
                ;(window as Window & { __e2e_lingva_release?: () => void }).__e2e_lingva_release?.()
            }).then(() => undefined),
        }
    }

    async pressSource(key: string): Promise<void> {
        await this.ensureSourceVisible()
        await this.page.getByTestId('source-input').press(key)
    }

    async dispatchComposingEnter(): Promise<void> {
        await this.sourceInput().evaluate((el) => {
            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
                cancelable: true,
            })
            Object.defineProperty(event, 'isComposing', { get: () => true })
            Object.defineProperty(event, 'keyCode', { get: () => 229 })
            Object.defineProperty(event, 'which', { get: () => 229 })
            el.dispatchEvent(event)
        })
    }

    async getSourceText(): Promise<string> {
        await this.ensureSourceVisible()
        return this.page.getByTestId('source-input').inputValue()
    }

    getDetectedLanguageLabel(): Promise<string | null> {
        return this.page.getByTestId('detected-lang').textContent()
    }

    // Language area
    getSourceLangLabel(): Promise<string | null> {
        return this.page.getByTestId('lang-source').textContent()
    }

    getTargetLangLabel(): Promise<string | null> {
        return this.page.getByTestId('lang-target').textContent()
    }

    clickSwap(): Promise<void> {
        return this.page.getByTestId('lang-swap').click()
    }

    clickDetectedLanguage(): Promise<void> {
        return this.page.getByTestId('detected-lang').click()
    }

    async selectSourceLanguage(language: string): Promise<void> {
        await this.ensureSourceVisible()
        await this.sourceLanguageButton().click()
        await this.page.getByTestId(`lang-source-option-${language}`).click()
    }

    async selectTargetLanguage(language: string): Promise<void> {
        await this.ensureSourceVisible()
        await this.targetLanguageButton().click()
        await this.page.getByTestId(`lang-target-option-${language}`).click()
    }

    async resizeWindowTo(width: number, height: number): Promise<void> {
        await this.page.evaluate((size) => { window.resizeTo(size.width, size.height); }, { width, height })
        const viewport = await this.page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
        await this.page.setViewportSize(viewport)
    }

    // Result cards
    resultCard(instanceKey: string): Locator {
        return this.page.locator(`[data-result-key="${instanceKey}"]`)
    }

    resultCards(): Locator {
        return this.page.locator('[data-result-key]')
    }

    resultAction(instanceKey: string, testId: string): Locator {
        return this.resultCard(instanceKey).getByTestId(testId)
    }

    resultDragHandle(instanceKey: string): Locator {
        return this.resultAction(instanceKey, 'result-drag')
    }

    resultBody(instanceKey: string): Locator {
        return this.resultCard(instanceKey).getByTestId('result-body')
    }

    resultError(instanceKey: string): Locator {
        return this.resultCard(instanceKey).getByTestId('result-error')
    }

    resultRetryButton(instanceKey: string): Locator {
        return this.resultAction(instanceKey, 'result-retry')
    }

    async result_action_order(instanceKey: string): Promise<string[]> {
        const expected = new Set(['result-tts', 'result-copy', 'result-collapse'])
        return this.resultCard(instanceKey).locator('[data-testid]').evaluateAll((elements, ids) => {
            const expected_ids = new Set(ids)
            return elements
                .map((element) => element.getAttribute('data-testid') ?? '')
                .filter((id) => expected_ids.has(id))
        }, Array.from(expected))
    }

    async result_card_keys(): Promise<string[]> {
        return this.resultCards().evaluateAll((elements) => elements
            .map((element) => element.getAttribute('data-result-key') ?? '')
            .filter(Boolean))
    }

    clickResultCopy(instanceKey: string): Promise<void> {
        return this.resultAction(instanceKey, 'result-copy').click()
    }

    result_tts_button(instanceKey: string): Locator {
        return this.resultAction(instanceKey, 'result-tts')
    }

    click_result_tts(instanceKey: string): Promise<void> {
        return this.result_tts_button(instanceKey).click()
    }

    clickResultCollapse(instanceKey: string): Promise<void> {
        return this.resultAction(instanceKey, 'result-collapse').click()
    }

    clickResultRetry(instanceKey: string): Promise<void> {
        return this.resultRetryButton(instanceKey).click()
    }

    async drag_result_card(sourceKey: string, targetKey: string): Promise<void> {
        const source_handle = this.resultDragHandle(sourceKey)
        const target_card = this.resultCard(targetKey)
        await source_handle.scrollIntoViewIfNeeded()
        await target_card.scrollIntoViewIfNeeded()
        await source_handle.scrollIntoViewIfNeeded()

        const source_box = await source_handle.boundingBox()
        const target_box = await target_card.boundingBox()
        if (!source_box || !target_box) throw new Error('Result card drag target is not visible')

        const viewport = this.page.viewportSize()
        if (viewport && (
            source_box.y < 0
            || source_box.y + source_box.height > viewport.height
            || target_box.y < 0
            || target_box.y + target_box.height > viewport.height
        )) {
            throw new Error('Result card drag source and target must be visible together')
        }

        const source_x = source_box.x + source_box.width / 2
        const source_y = source_box.y + source_box.height / 2
        const target_y = target_box.y + target_box.height / 2

        await this.page.mouse.move(source_x, source_y)
        await this.page.mouse.down()
        await this.page.mouse.move(source_x, source_y + Math.sign(target_y - source_y) * 8)
        await this.page.mouse.move(source_x, target_y, { steps: 16 })
        await this.page.mouse.up()
    }

    /** @stubbed Page-level fetch interceptor. Prefer TranslationTestServer for new tests. */
    async fail_then_succeed_lingva_translation_once(translation: string): Promise<void> {
        await this.page.evaluate((translation_text: string) => {
            const original_fetch = window.fetch.bind(window)
            let request_count = 0
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
                if (url.includes('/api/v1/') && !url.includes('/api/v1/audio/')) {
                    request_count += 1
                    if (request_count === 1) {
                        return new Response(JSON.stringify({ error: 'e2e translation failure' }), {
                            status: 500,
                            headers: { 'content-type': 'application/json' },
                        })
                    }
                    return new Response(JSON.stringify({ translation: translation_text }), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    })
                }
                return original_fetch(input, init)
            }
        }, translation)
    }

    /** @stubbed Page-level fetch interceptor. No longer used by converted tests; prefer TranslationTestServer. */
    async fulfill_lingva_translation_once(translation: string, target_language = 'zh'): Promise<void> {
        await this.page.evaluate(({ translation_text, target_language_code }) => {
            const original_fetch = window.fetch.bind(window)
            let consumed = false
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
                if (!consumed && url.includes('/api/v1/') && !url.includes('/api/v1/audio/') && url.includes(`/${target_language_code}/`)) {
                    consumed = true
                    return new Response(JSON.stringify({ translation: translation_text }), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    })
                }
                return original_fetch(input, init)
            }
        }, { translation_text: translation, target_language_code: target_language })
    }

    /** @stubbed Page-level fetch interceptor. No longer used by converted tests; prefer TranslationTestServer. */
    async fulfill_mymemory_translation_once(translation: string): Promise<void> {
        await this.page.evaluate((translation_text: string) => {
            const original_fetch = window.fetch.bind(window)
            let consumed = false
            const mock_body = JSON.stringify({ responseData: { translatedText: translation_text }, responseStatus: 200 })
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
                if (!consumed && url.startsWith('https://api.mymemory.translated.net/get')) {
                    consumed = true
                    return new Response(mock_body, { status: 200, headers: { 'content-type': 'application/json' } })
                }
                return original_fetch(input, init)
            }
        }, translation)
    }

    async hold_lingva_tts(): Promise<{ wait_for_request: () => Promise<void>; wait_for_request_count: (expected_count: number) => Promise<void>; release_response: () => Promise<void> }> {
        await this.page.evaluate(() => {
            type E2eWindow = Window & {
                __e2e_lingva_tts_request_count?: number
                __e2e_lingva_tts_release?: () => void
            }
            const e2e_window = window as E2eWindow
            const original_fetch = window.fetch.bind(window)
            const release_promise = new Promise<void>((resolve) => {
                e2e_window.__e2e_lingva_tts_release = resolve
            })
            e2e_window.__e2e_lingva_tts_request_count = 0
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
                if (url.includes('/api/v1/audio/')) {
                    e2e_window.__e2e_lingva_tts_request_count = (e2e_window.__e2e_lingva_tts_request_count ?? 0) + 1
                    await release_promise
                    return new Response(JSON.stringify({ audio: [1, 2, 3] }), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    })
                }
                return original_fetch(input, init)
            }
        })

        return {
            wait_for_request: async () => {
                await this.page.waitForFunction(() => {
                    return ((window as Window & { __e2e_lingva_tts_request_count?: number }).__e2e_lingva_tts_request_count ?? 0) > 0
                }, undefined, { timeout: 10_000 })
            },
            wait_for_request_count: async (expected_count: number) => {
                const end = Date.now() + 1_000
                while (Date.now() < end) {
                    const request_count = await this.page.evaluate(() => {
                        return ((window as Window & { __e2e_lingva_tts_request_count?: number }).__e2e_lingva_tts_request_count ?? 0)
                    })
                    if (request_count !== expected_count) {
                        throw new Error(`Expected ${String(expected_count)} Lingva TTS request(s), got ${String(request_count)}`)
                    }
                    const delay = Math.min(50, end - Date.now())
                    if (delay > 0) await this.page.waitForTimeout(delay)
                }
            },
            release_response: () => this.page.evaluate(() => {
                ;(window as Window & { __e2e_lingva_tts_release?: () => void }).__e2e_lingva_tts_release?.()
            }).then(() => undefined),
        }
    }

    async fulfill_free_dictionary_once(result: unknown): Promise<void> {
        await this.page.evaluate((mock_body: unknown) => {
            const original_fetch = window.fetch.bind(window)
            let consumed = false
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
                if (!consumed && url.startsWith('https://api.dictionaryapi.dev/api/v2/entries/en/')) {
                    consumed = true
                    return new Response(JSON.stringify(mock_body), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    })
                }
                return original_fetch(input, init)
            }
        }, result)
    }

    async waitForNoDetectedLanguage(duration = 2_000): Promise<void> {
        const end = Date.now() + duration
        while (Date.now() < end) {
            const count = await this.detectedLanguage().count()
            if (count > 0) {
                throw new Error(`Expected no detected language label, found ${String(count)}`)
            }
            await this.page.waitForTimeout(Math.min(100, end - Date.now()))
        }
    }

    async waitAllResults(timeout = 30_000): Promise<void> {
        // Wait for all result cards to have content (not undefined/loading)
        await this.page.waitForFunction(() => {
            const cards = document.querySelectorAll('[data-result-key]')
            if (cards.length === 0) return false
            return Array.from(cards).every((card) => {
                const content = card.querySelector('[data-result-content]')
                const error = card.querySelector('[data-result-error]')
                return content !== null || error !== null
            })
        }, { timeout })
    }

    async waitForResultCount(minCount: number, timeout = 30_000): Promise<void> {
        await this.page.waitForFunction(
            (min) => document.querySelectorAll('[data-result-key]').length >= min,
            minCount,
            { timeout }
        )
    }

    async getResultText(instanceKey: string): Promise<string | null> {
        const card = this.resultCard(instanceKey)
        const content = card.locator('[data-result-content]')
        if (await content.count() > 0) {
            return content.textContent()
        }
        return null
    }

    async hasResultError(instanceKey: string): Promise<boolean> {
        const card = this.resultCard(instanceKey)
        return card.locator('[data-result-error]').count().then(c => c > 0)
    }

    async documentPrimaryColor(): Promise<string> {
        return this.page.evaluate(() => document.documentElement.dataset.primaryColor ?? '')
    }

    async documentTransparent(): Promise<string | undefined> {
        return this.page.evaluate(() => document.documentElement.dataset.transparent)
    }

    async documentTheme(): Promise<string | undefined> {
        return this.page.evaluate(() => document.documentElement.dataset.theme)
    }

    async documentHasDarkClass(): Promise<boolean> {
        return this.page.evaluate(() => document.documentElement.classList.contains('dark'))
    }
}
