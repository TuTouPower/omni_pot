import type { Page, Locator } from '@playwright/test'

export class TranslatePage {
    constructor(private page: Page) {}

    wordmark(): Locator {
        return this.page.getByTestId('titlebar-wordmark')
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

    detectedLanguage(): Locator {
        return this.page.getByTestId('detected-lang')
    }

    sourceLanguage(): Locator {
        return this.page.getByTestId('lang-source')
    }

    targetLanguage(): Locator {
        return this.page.getByTestId('lang-target')
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

    // Result cards
    resultCard(instanceKey: string): Locator {
        return this.page.locator(`[data-result-key="${instanceKey}"]`)
    }

    resultCards(): Locator {
        return this.page.locator('[data-result-key]')
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
