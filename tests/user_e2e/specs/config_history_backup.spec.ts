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
            await expect(row.getByTestId('history-service-tile')).toHaveAttribute('title', 'mymemory@e2e')
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

    test('translation history stores service_key by service instance key for same-service instances', async () => {
        const server = new TranslationTestServer()
        let omni: AppFixture | null = null

        try {
            const port = await server.start()
            const base_url = `http://127.0.0.1:${String(port)}`
            omni = await AppFixture.start({
                config: {
                    translate_source_language: 'en',
                    translate_service_list: ['mymemory@first', 'mymemory@second'],
                    service_instances: {
                        'mymemory@first': { serviceKey: 'mymemory', config: { custom_url: base_url } },
                        'mymemory@second': { serviceKey: 'mymemory', config: { custom_url: base_url } },
                    },
                },
            })
            server.set_mymemory_response({ translated_text: '同服务多实例译文', status: 200 })

            const translate = await omni.translate()
            await translate.typeSource('same service instance history source')
            await translate.clickTranslate()
            await expect(translate.resultBody('mymemory@first')).toContainText('同服务多实例译文')
            await expect(translate.resultBody('mymemory@second')).toContainText('同服务多实例译文')

            const config = await omni.openConfig()
            await expect.poll(async () => config.historyRecordCount()).toBe(2)
            const service_keys = (await config.historyRecords())
                .map((record) => record.service_key)
                .sort()
            expect(service_keys).toEqual(['mymemory@first', 'mymemory@second'])
        } finally {
            await server.stop()
            await omni?.stop()
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

    test('user searches and filters history records from the toolbar', async () => {
        const omni = await AppFixture.start()

        try {
            const config = await omni.openConfig()
            await config.addHistoryRecord({
                service_key: 'mymemory@first',
                source_text: 'apple source keep',
                source_lang: 'en',
                target_text: '苹果译文',
                target_lang: 'zh_cn',
            })
            await config.addHistoryRecord({
                service_key: 'deepl@default',
                source_text: 'apple source other',
                source_lang: 'en',
                target_text: '其他苹果译文',
                target_lang: 'zh_cn',
            })
            await config.addHistoryRecord({
                service_key: 'mymemory@first',
                source_text: 'banana source',
                source_lang: 'en',
                target_text: '香蕉译文',
                target_lang: 'zh_cn',
            })

            await config.openSection('history')
            await expect(config.historyRows()).toHaveCount(3)

            await config.historySearch().fill('apple')
            await expect(config.historyRows()).toHaveCount(2)
            await expect(config.historyCount()).toContainText('共 2 条')
            await expect(config.historyRowBySource('apple source keep')).toBeVisible()
            await expect(config.historyRowBySource('apple source other')).toBeVisible()

            await config.historyServiceFilter().selectOption('mymemory@first')
            await expect(config.historyRows()).toHaveCount(1)
            await expect(config.historyRowBySource('apple source keep')).toBeVisible()
            await expect(config.historyCount()).toContainText('共 1 条')

            await config.historyTimeFilter().selectOption('1')
            await expect(config.historyRows()).toHaveCount(1)
            await expect(config.historyRowBySource('apple source keep')).toBeVisible()
        } finally {
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

            // Spec §9.8 + demo: 第一个标签是"启用"（正向语义）
            const toolbar = disable_switch.locator('..')
            await expect(toolbar.locator('> span').first()).toContainText('启用')

            // Demo: 搜索框内有搜索图标
            const search_wrapper = search.locator('..')
            await expect(search_wrapper.locator('svg')).toBeVisible()

            // Demo: 时间筛选选项为"全部时间/今天/本周/本月"
            const time_options = time_filter.locator('option')
            await expect(time_options).toHaveCount(4)
            await expect(time_options.nth(0)).toHaveText('全部时间')
            await expect(time_options.nth(1)).toHaveText('今天')
            await expect(time_options.nth(2)).toHaveText('本周')
            await expect(time_options.nth(3)).toHaveText('本月')

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
            await config.setting('cfg-app_theme-dark').click()
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
            // Backup was created with default app_theme='system'; restore reverts dark→system.
            await expect.poll(async () => (await omni.api.getConfig()).app_theme).toBe('system')

            const restartedConfig = await omni.openConfig()
            await expect.poll(async () => restartedConfig.documentTheme()).not.toBe('dark')
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
