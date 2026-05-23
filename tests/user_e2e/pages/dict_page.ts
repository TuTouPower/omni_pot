import type { Page, Locator } from '@playwright/test'

function is_target_closed_error(error: unknown): boolean {
    return error instanceof Error && error.message.includes('Target page, context or browser has been closed')
}

export class DictPage {
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

    topmostButton(): Locator {
        return this.page.getByTestId('titlebar-topmost')
    }

    closeButton(): Locator {
        return this.page.getByTestId('titlebar-close')
    }

    word(): Locator {
        return this.page.getByTestId('dict-word')
    }

    searchInputs(): Locator {
        return this.page.locator('input, textarea')
    }

    newlineButtons(): Locator {
        return this.page.getByTestId('dict-newline-btn')
    }

    ttsButton(): Locator {
        return this.page.getByTestId('dict-source-tts-btn')
    }

    lookupButton(): Locator {
        return this.page.getByTestId('dict-lookup-btn')
    }

    detectedLang(): Locator {
        return this.page.getByTestId('dict-detected-lang')
    }

    posTags(): Locator {
        return this.page.getByTestId('dict-pos-tag')
    }

    collectButton(): Locator {
        return this.page.getByTestId('dict-collect-btn')
    }

    sourceCollectButton(): Locator {
        return this.page.getByTestId('dict-source-collect-btn')
    }

    copyButtons(): Locator {
        return this.page.getByTestId('dict-copy-btn')
    }

    definitions(): Locator {
        return this.page.getByTestId('dict-definition')
    }

    pronunciations(): Locator {
        return this.page.getByTestId('dict-pronunciation')
    }

    examples(): Locator {
        return this.page.getByTestId('dict-example')
    }

    sourceTags(): Locator {
        return this.page.getByTestId('dict-source-tag')
    }

    // Titlebar
    clickPin(): Promise<void> {
        return this.pinButton().click()
    }

    async clickClose(): Promise<void> {
        try {
            await this.closeButton().click()
        } catch (error) {
            if (!is_target_closed_error(error)) throw error
        }
    }

    getModeLabel(): Promise<string | null> {
        return this.modeLabel().textContent()
    }

    clickCollect(): Promise<void> {
        return this.collectButton().click()
    }

    async fulfill_anki_collection_once(): Promise<void> {
        await this.page.route('http://localhost:8765/', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ result: null, error: null }),
            })
        }, { times: 1 })
    }

    clickFirstCopy(): Promise<void> {
        return this.copyButtons().first().click()
    }

    titlebarOrder(): Promise<string[]> {
        const items = [
            { name: 'topmost', locator: this.topmostButton() },
            { name: 'pin', locator: this.pinButton() },
            { name: 'wordmark', locator: this.wordmark() },
            { name: 'mode', locator: this.modeLabel() },
            { name: 'close', locator: this.closeButton() },
        ]
        return Promise.all(items.map(async (item) => {
            const box = await item.locator.boundingBox()
            return { name: item.name, x: box?.x ?? Number.POSITIVE_INFINITY }
        })).then((positions) => positions.sort((a, b) => a.x - b.x).map((item) => item.name))
    }

    async editWordAndSubmit(word: string): Promise<void> {
        await this.word().fill(word)
        await this.word().press('Enter')
    }

    // Dict cards
    dictCards(): Locator {
        return this.page.locator('[data-testid="dict-card"]')
    }

    dictCardCount(): Promise<number> {
        return this.dictCards().count()
    }

    async waitForCards(minCount = 1, timeout = 30_000): Promise<void> {
        await this.page.waitForFunction(
            (min) => document.querySelectorAll('[data-testid="dict-card"]').length >= min,
            minCount,
            { timeout }
        )
    }

    async resultKeys(): Promise<string[]> {
        const cards = this.dictCards()
        const count = await cards.count()
        const keys: string[] = []
        for (let i = 0; i < count; i++) {
            const key = await cards.nth(i).getAttribute('data-result-key')
            if (key) keys.push(key)
        }
        return keys
    }

    /**
     * Returns result keys for cards that have actual result content (definitions).
     * Unlike `resultKeys()`, this excludes rendered but unqueried service cards.
     */
    async resultKeysWithContent(): Promise<string[]> {
        const cards = this.dictCards()
        const count = await cards.count()
        const keys: string[] = []
        for (let i = 0; i < count; i++) {
            const card = cards.nth(i)
            const key = await card.getAttribute('data-result-key')
            if (!key) continue
            const defCount = await card.getByTestId('dict-definition').count()
            if (defCount > 0) keys.push(key)
        }
        return keys
    }
}
