import type { Locator, Page } from '@playwright/test'

export class ConfigPage {
    constructor(private page: Page) {}

    title(): Locator {
        return this.page.getByTestId('config-title')
    }

    closeButton(): Locator {
        return this.page.getByTestId('config-close')
    }

    nav(pageKey: string): Locator {
        return this.page.getByTestId(`config-nav-${pageKey}`)
    }

    setting(testId: string): Locator {
        return this.page.getByTestId(testId)
    }

    field(testId: string): Locator {
        return this.setting(testId).locator('input')
    }

    serviceItems(): Locator {
        return this.page.getByTestId('svc-item')
    }

    addServiceButton(): Locator {
        return this.page.getByTestId('svc-add-btn')
    }

    async openSection(pageKey: string): Promise<void> {
        await this.nav(pageKey).click()
    }

    clickClose(): Promise<void> {
        return this.closeButton().click()
    }
}
