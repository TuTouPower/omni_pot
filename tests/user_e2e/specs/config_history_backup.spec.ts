import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import { TranslationTestServer } from '../fixtures/translation_test_server'

test.describe('@ui config history and backup settings', () => {
    test('user sees a successful translation in history, edits it, and clears it', async () => {
        const omni = await AppFixture.start({ config: { translate_source_language: 'en' } })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            server.set_mymemory_response({ translated_text: '历史译文', status: 200 })

            const translate = await omni.translate()

            await translate.typeSource('history source text')
            await translate.clickTranslate()
            await expect(translate.resultBody('mymemory@e2e')).toContainText('历史译文')

            const config = await omni.openConfig()
            await config.openSection('history')

            const row = config.historyRowBySource('history source text')
            await expect(config.historyRows()).toHaveCount(1)
            await expect(row.getByTestId('history-language')).toContainText(/EN.*ZH/)
            await expect(row.getByTestId('history-service-tile')).toContainText('mymemory@e2e')
            await expect(row.getByTestId('history-target')).toContainText('历史译文')
            await expect(row.getByTestId('history-created-at')).not.toBeEmpty()
            await expect.poll(async () => config.historyRecordCount()).toBe(1)

            await row.click()
            await expect(config.historyEditModal()).toBeVisible()
            await config.historyEditSource().fill('edited history source')
            await config.historyEditTarget().fill('编辑后的译文')
            await config.historyEditSaveButton().click()

            const editedRow = config.historyRowBySource('edited history source')
            await expect(editedRow.getByTestId('history-target')).toContainText('编辑后的译文')
            await expect(config.historyEditModal()).toHaveCount(0)

            await config.historyClearButton().click()
            await expect(config.historyEmpty()).toContainText('暂无历史记录')
            await expect.poll(async () => config.historyRecordCount()).toBe(0)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('user pages through history records', async () => {
        const omni = await AppFixture.start()

        try {
            const config = await omni.openConfig()
            for (let index = 1; index <= 25; index += 1) {
                await config.addHistoryRecord({
                    service_key: 'mymemory@default',
                    source_text: `source ${String(index)}`,
                    source_lang: 'en',
                    target_text: `译文 ${String(index)}`,
                    target_lang: 'zh_cn',
                })
            }

            await config.openSection('history')
            await expect(config.historyCount()).toContainText('共 25 条')
            await expect(config.historyPage()).toHaveText('1 / 2')
            await expect(config.historyRowBySource('source 25')).toBeVisible()

            await config.historyNextButton().click()
            await expect(config.historyPage()).toHaveText('2 / 2')
            await expect(config.historyRowBySource('source 5')).toBeVisible()

            await config.historyPrevButton().click()
            await expect(config.historyPage()).toHaveText('1 / 2')
            await expect(config.historyRowBySource('source 25')).toBeVisible()
        } finally {
            await omni.stop()
        }
    })

    test('user disables history and new translations are not recorded', async () => {
        const omni = await AppFixture.start({ config: { history_disable: true } })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            server.set_mymemory_response({ translated_text: '不会写入历史', status: 200 })

            const translate = await omni.translate()

            await translate.typeSource('disabled history source')
            await translate.clickTranslate()
            await expect(translate.resultBody('mymemory@e2e')).toContainText('不会写入历史')

            const config = await omni.openConfig()
            await config.openSection('history')
            await expect(config.historyEmpty()).toContainText('暂无历史记录')
            await expect.poll(async () => config.historyRecordCount()).toBe(0)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('history toolbar renders all controls on one row and disable switch grays out other controls', async () => {
        const omni = await AppFixture.start({ config: { history_disable: false } })

        try {
            const config = await omni.openConfig()
            await config.openSection('history')

            // Spec §9.8: 启用开关 + 搜索 + 服务筛选 + 时间筛选 + 清空一行完整展示。
            const disable_switch = config.setting('cfg-history_disable')
            const search = config.page.getByTestId('history-search')
            const service_filter = config.page.getByTestId('history-service-filter')
            const time_filter = config.page.getByTestId('history-time-filter')
            const clear = config.page.getByTestId('history-clear')

            await expect(disable_switch).toBeVisible()
            await expect(search).toBeVisible()
            await expect(service_filter).toBeVisible()
            await expect(time_filter).toBeVisible()
            await expect(clear).toBeVisible()

            // All controls should share a similar y coordinate (same row).
            const boxes = await Promise.all([
                disable_switch.boundingBox(),
                search.boundingBox(),
                service_filter.boundingBox(),
                time_filter.boundingBox(),
                clear.boundingBox(),
            ])
            const y_values = boxes.filter((b): b is NonNullable<typeof b> => b !== null).map((b) => b.y)
            const max_y_spread = Math.max(...y_values) - Math.min(...y_values)
            expect(max_y_spread, 'history toolbar controls should be on one row').toBeLessThan(50)

            // Spec §9.8: 启用关闭时其余控件置灰禁用。
            await disable_switch.click()
            await expect(search).toBeDisabled()
            await expect(time_filter).toBeDisabled()
            await expect(clear).toBeDisabled()

            // Re-enable.
            await disable_switch.click()
            await expect(search).toBeEnabled()
            await expect(time_filter).toBeEnabled()
            await expect(clear).toBeEnabled()
        } finally {
            await omni.stop()
        }
    })

    test('user creates a local backup and restores config and history after restart', async () => {
        const omni = await AppFixture.start({ config: { backup_type: 'webdav' } })
        let server: TranslationTestServer | null = null

        try {
            server = await omni.startTranslationTestServer()
            server.set_mymemory_response({ translated_text: '备份前译文', status: 200 })

            const translate = await omni.translate()
            await translate.typeSource('backup history source')
            await translate.clickTranslate()
            await expect(translate.resultBody('mymemory@e2e')).toContainText('备份前译文')

            const config = await omni.openConfig()
            await expect.poll(async () => config.historyRecordCount()).toBe(1)
            await config.openSection('backup')

            await expect(config.field('cfg-webdav_url')).toBeVisible()
            await config.setting('cfg-backup_type-local').click()
            await expect(config.field('cfg-webdav_url')).toHaveCount(0)
            await expect.poll(async () => (await omni.api.getConfig()).backup_type).toBe('local')

            await expect(config.backupContentHint()).toContainText('设置、历史记录数据库、CC-CEDICT 词典数据库')
            await config.backupCreateButton().click()
            await expect(config.backupStatus()).toContainText('Backup created', { timeout: 10_000 })
            await expect(config.backupRows()).toHaveCount(1)
            const backupName = await config.latestBackupName()
            expect(backupName).toMatch(/^pot-backup-.*\.zip$/)

            await config.openSection('general')
            await config.select('cfg-app_theme', 'dark')
            await expect.poll(async () => (await omni.api.getConfig()).app_theme).toBe('dark')

            await config.openSection('history')
            await config.historyClearButton().click()
            await expect(config.historyEmpty()).toContainText('暂无历史记录')
            await expect.poll(async () => config.historyRecordCount()).toBe(0)

            await config.openSection('backup')
            await config.backupOpenRestoreButton().click()
            await expect(config.backupRestoreModal()).toBeVisible()
            await expect(config.backupRestoreRows()).toHaveCount(1)
            await config.backupRestoreAction(backupName).click()
            await expect(config.backupStatus()).toContainText('Restored successfully', { timeout: 10_000 })

            await omni.restart()
            await expect.poll(async () => (await omni.api.getConfig()).app_theme).toBe('light')

            const restartedConfig = await omni.openConfig()
            await expect.poll(async () => restartedConfig.documentTheme()).toBe('light')
            await restartedConfig.openSection('history')
            const restoredRow = restartedConfig.historyRowBySource('backup history source')
            await expect(restoredRow.getByTestId('history-target')).toContainText('备份前译文')
            await expect.poll(async () => restartedConfig.historyRecordCount()).toBe(1)
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })
})
