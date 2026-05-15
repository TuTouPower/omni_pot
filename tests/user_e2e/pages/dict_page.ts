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

    collectButton(): Locator {
        return this.page.getByTestId('dict-collect-btn')
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

    clickFirstCopy(): Promise<void> {
        return this.copyButtons().first().click()
    }

    titlebarOrder(): Promise<string[]> {
        const items = [
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
}
