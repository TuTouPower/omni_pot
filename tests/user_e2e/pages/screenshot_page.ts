import type { Locator, Page } from '@playwright/test'

export class ScreenshotPage {
    constructor(private page: Page) {}

    overlay(): Locator {
        return this.page.getByTestId('shot-overlay')
    }

    selection(): Locator {
        return this.page.getByTestId('shot-selection')
    }

    sizeLabel(): Locator {
        return this.page.getByTestId('shot-size-label')
    }

    hint(): Locator {
        return this.page.getByTestId('shot-hint')
    }
}
