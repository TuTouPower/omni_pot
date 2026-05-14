import type { Locator, Page } from '@playwright/test'

export class UpdaterPage {
    constructor(private page: Page) {}

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
