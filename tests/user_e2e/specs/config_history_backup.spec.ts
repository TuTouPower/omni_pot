import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const LINGVA_INSTANCE = {
    serviceKey: 'lingva',
    config: { requestPath: 'https://lingva.lunar.icu' },
}

function lingva_config(config: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        app_language: 'zh_cn',
        app_theme: 'light',
        dynamic_translate: false,
        translate_detect_engine: 'local',
        translate_source_language: 'en',
        translate_target_language: 'zh_cn',
        translate_service_list: ['lingva@default'],
        service_instances: { 'lingva@default': LINGVA_INSTANCE },
        ...config,
    }
}

test.describe('@ui config history and backup settings', () => {
    test('user sees a successful translation in history, edits it, and clears it', async () => {
        const omni = await AppFixture.start({ config: lingva_config() })

        try {
            const translate = await omni.translate()
            await translate.fulfill_lingva_translation_once('历史译文')

            await translate.typeSource('history source text')
            await translate.clickTranslate()
            await expect(translate.resultBody('lingva@default')).toContainText('历史译文')

            const config = await omni.openConfig()
            await config.openSection('history')

            const row = config.historyRowBySource('history source text')
            await expect(config.historyRows()).toHaveCount(1)
            await expect(row.getByTestId('history-language')).toContainText('en → zh_cn')
            await expect(row.getByTestId('history-service')).toContainText('lingva@default')
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
            await omni.stop()
        }
    })

    test('user pages through history records', async () => {
        const omni = await AppFixture.start({ config: lingva_config() })

        try {
            const config = await omni.openConfig()
            for (let index = 1; index <= 25; index += 1) {
                await config.addHistoryRecord({
                    service_key: 'lingva@default',
                    source_text: `source ${index}`,
                    source_lang: 'en',
                    target_text: `译文 ${index}`,
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
        const omni = await AppFixture.start({ config: lingva_config({ history_disable: true }) })

        try {
            const translate = await omni.translate()
            await translate.fulfill_lingva_translation_once('不会写入历史')

            await translate.typeSource('disabled history source')
            await translate.clickTranslate()
            await expect(translate.resultBody('lingva@default')).toContainText('不会写入历史')

            const config = await omni.openConfig()
            await config.openSection('history')
            await expect(config.historyEmpty()).toContainText('暂无历史记录')
            await expect.poll(async () => config.historyRecordCount()).toBe(0)
        } finally {
            await omni.stop()
        }
    })

    test('user creates a local backup and restores config and history after restart', async () => {
        const omni = await AppFixture.start({ config: lingva_config({ backup_type: 'webdav' }) })

        try {
            const translate = await omni.translate()
            await translate.fulfill_lingva_translation_once('备份前译文')
            await translate.typeSource('backup history source')
            await translate.clickTranslate()
            await expect(translate.resultBody('lingva@default')).toContainText('备份前译文')

            const config = await omni.openConfig()
            await expect.poll(async () => config.historyRecordCount()).toBe(1)
            await config.openSection('backup')

            await expect(config.field('cfg-webdav_url')).toBeVisible()
            await config.setting('cfg-backup_type').click()
            await expect(config.selectOption('cfg-backup_type', 'webdav')).toBeVisible()
            await expect(config.selectOption('cfg-backup_type', 'local')).toBeVisible()
            await expect(config.selectOption('cfg-backup_type', 'aliyun')).toHaveCount(0)
            await config.selectOption('cfg-backup_type', 'local').click()
            await expect(config.field('cfg-webdav_url')).toHaveCount(0)
            await expect.poll(async () => (await omni.api.getConfig()).backup_type).toBe('local')

            await expect(config.backupContentHint()).toContainText('配置、历史记录数据库、CC-CEDICT 词典数据库')
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
            await omni.stop()
        }
    })
})
