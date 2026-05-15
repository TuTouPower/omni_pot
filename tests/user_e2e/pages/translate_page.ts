import type { Page, Locator } from '@playwright/test'

export class TranslatePage {
    constructor(private page: Page) {}

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

    closeButton(): Locator {
        return this.page.getByTestId('titlebar-close')
    }

    sourceInput(): Locator {
        return this.page.getByTestId('source-input')
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

    clickClose(): Promise<void> {
        return this.page.getByTestId('titlebar-close').click()
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
    typeSource(text: string): Promise<void> {
        return this.page.getByTestId('source-input').fill(text)
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

    async hold_lingva_translation_once(translation: string): Promise<{ wait_for_request: () => Promise<void>; release_response: () => void }> {
        let release_response = (): void => {}
        const release_promise = new Promise<void>((resolve) => {
            release_response = resolve
        })
        let resolve_request = (): void => {}
        let reject_request = (_error: Error): void => {}
        const request_promise = new Promise<void>((resolve, reject) => {
            resolve_request = resolve
            reject_request = reject
        })
        const timeout = setTimeout(() => reject_request(new Error('Timed out waiting for Lingva translation request')), 10_000)

        await this.page.route('https://lingva.lunar.icu/api/v1/*/zh/**', async (route) => {
            clearTimeout(timeout)
            resolve_request()
            await release_promise
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ translation }),
            })
        }, { times: 1 })

        return {
            wait_for_request: () => request_promise,
            release_response,
        }
    }

    pressSource(key: string): Promise<void> {
        return this.page.getByTestId('source-input').press(key)
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

    getSourceText(): Promise<string> {
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
        await this.sourceLanguageButton().click()
        await this.page.getByTestId(`lang-source-option-${language}`).click()
    }

    async selectTargetLanguage(language: string): Promise<void> {
        await this.targetLanguageButton().click()
        await this.page.getByTestId(`lang-target-option-${language}`).click()
    }

    // Result cards
    resultCard(instanceKey: string): Locator {
        return this.page.locator(`[data-result-key="${instanceKey}"]`)
    }

    resultCards(): Locator {
        return this.page.locator('[data-result-key]')
    }

    async waitForNoDetectedLanguage(duration = 2_000): Promise<void> {
        const end = Date.now() + duration
        while (Date.now() < end) {
            const count = await this.detectedLanguage().count()
            if (count > 0) {
                throw new Error(`Expected no detected language label, found ${count}`)
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
}
