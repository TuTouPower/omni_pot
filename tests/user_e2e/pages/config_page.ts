import type { Locator, Page } from '@playwright/test'

export class ConfigPage {
    constructor(private page: Page) {}

    wordmark(): Locator {
        return this.page.getByTestId('config-wordmark')
    }

    pinButton(): Locator {
        return this.page.getByTestId('config-pin')
    }

    version(): Locator {
        return this.page.getByTestId('config-version')
    }

    title(): Locator {
        return this.page.getByTestId('config-title')
    }

    route(): Locator {
        return this.page.getByTestId('config-route')
    }

    closeButton(): Locator {
        return this.page.getByTestId('config-close')
    }

    nav(pageKey: string): Locator {
        return this.page.getByTestId(`config-nav-${pageKey}`)
    }

    navItems(): Locator {
        return this.page.locator('[data-testid^="config-nav-"]')
    }

    setting(testId: string): Locator {
        return this.page.getByTestId(testId)
    }

    field(testId: string): Locator {
        return this.setting(testId).locator('input')
    }

    selectOption(testId: string, value: string): Locator {
        return this.page.getByTestId(`${testId}-option-${value}`)
    }

    hotkeyField(configKey: string): Locator {
        return this.page.getByTestId(`cfg-${configKey}-field`)
    }

    hotkeyBindButton(configKey: string): Locator {
        return this.page.getByTestId(`cfg-${configKey}-bind`)
    }

    hotkeyConfirmButton(configKey: string): Locator {
        return this.page.getByTestId(`cfg-${configKey}-confirm`)
    }

    hotkeyStatus(configKey: string): Locator {
        return this.page.getByTestId(`cfg-${configKey}-status`)
    }

    serviceItems(): Locator {
        return this.page.getByTestId('svc-item')
    }

    addServiceButton(): Locator {
        return this.page.getByTestId('svc-add-btn')
    }

    aboutLink(name: 'home' | 'docs' | 'feedback'): Locator {
        return this.page.getByTestId(`about-${name}-link`)
    }

    aboutVersion(): Locator {
        return this.page.getByTestId('about-version')
    }

    aboutDiagnostic(testId: 'about-config-dir' | 'about-log-dir' | 'about-api-url'): Locator {
        return this.page.getByTestId(testId)
    }

    async openSection(pageKey: string): Promise<void> {
        await this.nav(pageKey).click()
    }

    clickPin(): Promise<void> {
        return this.pinButton().click()
    }

    clickClose(): Promise<void> {
        return this.closeButton().click()
    }

    async select(testId: string, value: string): Promise<void> {
        await this.setting(testId).click()
        await this.selectOption(testId, value).click()
    }

    async toggle(testId: string): Promise<void> {
        await this.setting(testId).click()
    }

    async fillField(testId: string, value: string): Promise<void> {
        await this.field(testId).fill(value)
    }

    async documentTheme(): Promise<string | undefined> {
        return this.page.evaluate(() => document.documentElement.dataset.theme)
    }

    async documentHasDarkClass(): Promise<boolean> {
        return this.page.evaluate(() => document.documentElement.classList.contains('dark'))
    }
}
