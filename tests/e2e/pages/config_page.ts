import type { Locator, Page } from '@playwright/test'
import type { HistoryRecord } from '@shared/types/ipc'
import type { E2eApi } from '../fixtures/e2e_api'

function exact_text(text: string): RegExp {
    return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

function css_attribute_value(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export class ConfigPage {
    constructor(private page: Page, private api?: E2eApi) {}

    window(): Locator {
        return this.page.getByTestId('config-window')
    }

    wordmark(): Locator {
        return this.page.getByTestId('config-wordmark')
    }

    titlebar(): Locator {
        return this.page.getByTestId('config-titlebar')
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

    hotkeyCancelButton(configKey: string): Locator {
        return this.page.getByTestId(`cfg-${configKey}-cancel`)
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

    serviceMoveControls(instanceKey: string): Locator {
        return this.serviceItem(instanceKey).locator('[data-testid="svc-move-up"], [data-testid="svc-move-down"]')
    }

    serviceDelete(instanceKey: string): Locator {
        return this.serviceItem(instanceKey).getByTestId('svc-delete')
    }

    serviceDragHandle(instanceKey: string): Locator {
        return this.serviceItem(instanceKey).getByTestId('svc-drag-handle')
    }

    serviceToggle(instanceKey: string): Locator {
        return this.serviceItem(instanceKey).getByTestId('svc-toggle')
    }

    serviceEdit(instanceKey: string): Locator {
        return this.serviceItem(instanceKey).getByTestId('svc-edit')
    }

    serviceEditModal(): Locator {
        return this.page.getByTestId('svc-edit-modal')
    }

    serviceEditName(): Locator {
        return this.page.getByTestId('svc-edit-name')
    }

    serviceEditConfig(): Locator {
        return this.page.getByTestId('svc-edit-config')
    }

    serviceTestButton(): Locator {
        return this.page.getByTestId('svc-test')
    }

    serviceTestStatus(): Locator {
        return this.page.getByTestId('svc-test-status')
    }

    serviceEditSaveButton(): Locator {
        return this.page.getByTestId('svc-edit-save')
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

    historySearch(): Locator {
        return this.page.getByTestId('history-search')
    }

    historyServiceFilter(): Locator {
        return this.page.getByTestId('history-service-filter')
    }

    historyTimeFilter(): Locator {
        return this.page.getByTestId('history-time-filter')
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
        if (!this.api) throw new Error('E2E API is required to seed history')
        const result = await this.api.addHistoryRecord(record)
        if (!result.success) throw new Error(result.error ?? 'failed to seed history')
    }

    historyRecordCount(): Promise<number> {
        return this.page.evaluate(() => window.electronAPI.history.count())
    }

    historyRecords(): Promise<HistoryRecord[]> {
        return this.page.evaluate(() => window.electronAPI.history.list(1, 100))
    }

    aboutLink(name: 'home' | 'docs' | 'survey'): Locator {
        return this.page.getByTestId(`about-${name}-link`)
    }

    aboutVersion(): Locator {
        return this.page.getByTestId('about-version')
    }

    aboutCheckUpdate(): Locator {
        return this.page.getByTestId('about-check-update')
    }

    aboutSupportAuthor(): Locator {
        return this.page.getByTestId('about-support-author')
    }

    aboutDiagnostic(testId: 'about-config-dir' | 'about-log-dir' | 'about-api-url'): Locator {
        return this.page.getByTestId(testId)
    }

    async appRegion(testId: string): Promise<string> {
        return this.page.getByTestId(testId).evaluate((element) => getComputedStyle(element).getPropertyValue('-webkit-app-region'))
    }

    async hasHorizontalOverflow(): Promise<boolean> {
        return this.page.evaluate(() => (
            document.documentElement.scrollWidth > document.documentElement.clientWidth
            || document.body.scrollWidth > document.body.clientWidth
        ))
    }

    async optionReceivesPointer(testId: string, value: string): Promise<boolean> {
        return this.selectOption(testId, value).evaluate((element) => {
            const rect = element.getBoundingClientRect()
            const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
            return target === element || element.contains(target)
        })
    }

    async clickOutsideSelects(): Promise<void> {
        await this.titlebar().click()
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

    async deleteService(instanceKey: string): Promise<void> {
        await this.serviceDelete(instanceKey).click()
    }

    async toggleService(instanceKey: string): Promise<void> {
        await this.serviceToggle(instanceKey).click()
    }

    async openServiceEditor(instanceKey: string): Promise<void> {
        await this.serviceEdit(instanceKey).click()
    }

    async fillServiceEditor(instance_name: string, configJson: string): Promise<void> {
        await this.serviceEditName().fill(instance_name)
        await this.serviceEditConfig().fill(configJson)
    }

    async testServiceConfig(): Promise<void> {
        await this.serviceTestButton().click()
    }

    async saveServiceConfig(): Promise<void> {
        await this.serviceEditSaveButton().click()
    }

    async fulfillLingvaTestOnce(translation = '你好'): Promise<void> {
        await this.page.evaluate((translation_text: string) => {
            const original_fetch = window.fetch.bind(window)
            let consumed = false
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
                if (!consumed && url.includes('/api/v1/en/zh/')) {
                    consumed = true
                    return new Response(JSON.stringify({ translation: translation_text }), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    })
                }
                return original_fetch(input, init)
            }
        }, translation)
    }

    async fulfillMymemoryTestOnce(translation = '你好'): Promise<void> {
        await this.page.evaluate((translation_text: string) => {
            const original_fetch = window.fetch.bind(window)
            let consumed = false
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
                if (!consumed && url.includes('/get') && url.includes('langpair=')) {
                    consumed = true
                    return new Response(JSON.stringify({
                        responseData: { translatedText: translation_text },
                        responseStatus: 200,
                    }), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    })
                }
                return original_fetch(input, init)
            }
        }, translation)
    }

    async dragService(sourceKey: string, targetKey: string): Promise<void> {
        const source_handle = this.serviceDragHandle(sourceKey)
        const target_item = this.serviceItem(targetKey)
        await source_handle.scrollIntoViewIfNeeded()
        await target_item.scrollIntoViewIfNeeded()
        await source_handle.scrollIntoViewIfNeeded()

        const source_box = await source_handle.boundingBox()
        const target_box = await target_item.boundingBox()
        if (!source_box || !target_box) throw new Error('Service drag target is not visible')

        const source_x = source_box.x + source_box.width / 2
        const source_y = source_box.y + source_box.height / 2
        const target_y = target_box.y + target_box.height / 2

        await this.page.mouse.move(source_x, source_y)
        await this.page.mouse.down()
        await this.page.mouse.move(source_x, source_y + Math.sign(target_y - source_y) * 8)
        await this.page.mouse.move(source_x, target_y, { steps: 16 })
        await this.page.mouse.up()
    }

    async fillField(testId: string, value: string): Promise<void> {
        await this.field(testId).fill(value)
    }

    primaryColorButtons(): Locator {
        return this.page.locator('[data-testid^="cfg-app_primary_color-"]')
    }

    async documentPrimaryColor(): Promise<string> {
        return this.page.evaluate(() => document.documentElement.dataset.primaryColor ?? '')
    }

    async documentTransparent(): Promise<string | undefined> {
        return this.page.evaluate(() => document.documentElement.dataset.transparent)
    }

    async documentTheme(): Promise<string | undefined> {
        return this.page.evaluate(() => document.documentElement.dataset.theme)
    }

    async documentHasDarkClass(): Promise<boolean> {
        return this.page.evaluate(() => document.documentElement.classList.contains('dark'))
    }
}
