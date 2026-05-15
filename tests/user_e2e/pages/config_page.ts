import type { Locator, Page } from '@playwright/test'
import type { HistoryRecord } from '@shared/types/ipc'

function exact_text(text: string): RegExp {
    return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

function css_attribute_value(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

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

    serviceTab(category: string): Locator {
        return this.page.getByTestId(`svc-tab-${category}`)
    }

    serviceItem(instanceKey: string): Locator {
        return this.page.locator(`[data-testid="svc-item"][data-service-key="${instanceKey}"]`)
    }

    serviceItemKeys(): Promise<string[]> {
        return this.serviceItems().evaluateAll((items) => items
            .map((item) => item.getAttribute('data-service-key') ?? '')
            .filter(Boolean))
    }

    serviceAddOption(serviceKey: string): Locator {
        return this.page.locator(`[data-testid="svc-add-option"][data-service-template="${serviceKey}"]`)
    }

    serviceMoveUp(instanceKey: string): Locator {
        return this.serviceItem(instanceKey).getByTestId('svc-move-up')
    }

    serviceMoveDown(instanceKey: string): Locator {
        return this.serviceItem(instanceKey).getByTestId('svc-move-down')
    }

    serviceDelete(instanceKey: string): Locator {
        return this.serviceItem(instanceKey).getByTestId('svc-delete')
    }

    serviceDragHandle(instanceKey: string): Locator {
        return this.serviceItem(instanceKey).getByTestId('svc-drag-handle')
    }

    addServiceButton(): Locator {
        return this.page.getByTestId('svc-add-btn')
    }

    historyRows(): Locator {
        return this.page.getByTestId('history-row')
    }

    historyRowBySource(sourceText: string): Locator {
        return this.historyRows().filter({ has: this.page.getByTestId('history-source').filter({ hasText: exact_text(sourceText) }) })
    }

    historyClearButton(): Locator {
        return this.page.getByTestId('history-clear')
    }

    historyEmpty(): Locator {
        return this.page.getByTestId('history-empty')
    }

    historyCount(): Locator {
        return this.page.getByTestId('history-count')
    }

    historyPage(): Locator {
        return this.page.getByTestId('history-page')
    }

    historyNextButton(): Locator {
        return this.page.getByTestId('history-next')
    }

    historyPrevButton(): Locator {
        return this.page.getByTestId('history-prev')
    }

    historyEditModal(): Locator {
        return this.page.getByTestId('history-edit-modal')
    }

    historyEditSource(): Locator {
        return this.page.getByTestId('history-edit-source')
    }

    historyEditTarget(): Locator {
        return this.page.getByTestId('history-edit-target')
    }

    historyEditSaveButton(): Locator {
        return this.page.getByTestId('history-edit-save')
    }

    backupCreateButton(): Locator {
        return this.page.getByTestId('backup-create')
    }

    backupOpenRestoreButton(): Locator {
        return this.page.getByTestId('backup-restore-open')
    }

    backupStatus(): Locator {
        return this.page.getByTestId('backup-status')
    }

    backupContentHint(): Locator {
        return this.page.getByTestId('backup-content-hint')
    }

    backupRows(): Locator {
        return this.page.getByTestId('backup-row')
    }

    backupRestoreModal(): Locator {
        return this.page.getByTestId('backup-restore-modal')
    }

    backupRestoreRows(): Locator {
        return this.page.getByTestId('backup-restore-row')
    }

    backupRestoreAction(name: string): Locator {
        return this.page.locator(`[data-testid="backup-restore-row"][data-backup-name="${css_attribute_value(name)}"]`).getByTestId('backup-restore-action')
    }

    async latestBackupName(): Promise<string> {
        const name = await this.backupRows().first().getAttribute('data-backup-name')
        if (!name) throw new Error('Backup row does not have a backup name')
        return name
    }

    async addHistoryRecord(record: Omit<HistoryRecord, 'id' | 'created_at'>): Promise<void> {
        await this.page.evaluate((nextRecord) => window.electronAPI.history.add(nextRecord), record)
    }

    historyRecordCount(): Promise<number> {
        return this.page.evaluate(() => window.electronAPI.history.count())
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

    async openServiceCategory(category: string): Promise<void> {
        await this.serviceTab(category).click()
    }

    async addService(serviceKey: string): Promise<void> {
        await this.addServiceButton().click()
        await this.serviceAddOption(serviceKey).click()
    }

    async moveServiceDown(instanceKey: string): Promise<void> {
        await this.serviceMoveDown(instanceKey).click()
    }

    async deleteService(instanceKey: string): Promise<void> {
        await this.serviceDelete(instanceKey).click()
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
