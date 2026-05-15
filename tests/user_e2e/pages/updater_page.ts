import type { Locator, Page } from '@playwright/test'

function exact_text(text: string): RegExp {
    return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

export class UpdaterPage {
    constructor(private page: Page) {}

    titleMode(): Locator {
        return this.page.locator('.op-mode')
    }

    body(): Locator {
        return this.page.locator('body')
    }

    downloadLink(name: string): Locator {
        return this.page.getByRole('link', { name: exact_text(name) })
    }

    progress(): Locator {
        return this.page.getByTestId('updater-progress')
    }

    changelog(): Locator {
        return this.page.getByTestId('updater-changelog')
    }

    confirmButton(): Locator {
        return this.page.getByTestId('updater-confirm')
    }

    laterButton(): Locator {
        return this.page.getByTestId('updater-later')
    }

    clickConfirm(): Promise<void> {
        return this.confirmButton().click()
    }

    clickLater(): Promise<void> {
        return this.laterButton().click()
    }
}
