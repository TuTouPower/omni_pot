import type { Page, Locator } from '@playwright/test'

export class DictPage {
    constructor(private page: Page) {}

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
