import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const BASE_CONFIG = {
    check_update: false,
    dynamic_translate: false,
    translate_detect_engine: 'local',
    translate_service_list: [],
    translate_source_language: 'auto',
    translate_target_language: 'zh_cn',
}

const MOCK_RELEASE = {
    version: '2.0.0',
    current_version: '1.0.0',
    name: 'E2E Release 2.0.0',
    body: 'Localized changelog text',
    html_url: 'https://example.invalid/omni_pot/releases/2.0.0',
    published_at: '2026-05-15T08:30:00.000Z',
    assets: [{
        name: 'omni_pot-2.0.0-win.zip',
        url: 'https://example.invalid/omni_pot-2.0.0-win.zip',
    }],
}

async function expect_config(omni: AppFixture, key: string, value: unknown): Promise<void> {
    await expect.poll(async () => (await omni.api.getConfig())[key]).toEqual(value)
}

async function expect_tray_labels(omni: AppFixture, labels: string[]): Promise<void> {
    await expect.poll(async () => (await omni.api.trayMenu()).labels).toEqual(labels)
}

test.describe('@ui i18n', () => {
    test('user switches interface language and already-open windows update immediately', async () => {
        const omni = await AppFixture.start({ config: { ...BASE_CONFIG, app_language: 'zh_cn' } })

        try {
            const translate = await omni.translate()
            const config = await omni.openConfig()
            const recognize = await omni.openRecognize()
            const updater = await omni.mockUpdate(MOCK_RELEASE)

            await expect(translate.sourceInput()).toHaveAttribute('placeholder', '输入要翻译的文本...')
            await expect(translate.sourceLanguageButton()).toContainText('自动检测')
            await expect(translate.targetLanguageButton()).toContainText('简体中文')
            await expect(config.title()).toContainText('通用')
            await expect(config.nav('hotkey')).toContainText('快捷键')
            await expect(config.setting('cfg-app_language')).toContainText('简体中文')
            await expect(recognize.modeLabel()).toContainText('识别')
            await expect(recognize.languageSelect()).toContainText('自动检测')
            await expect(recognize.reRecognizeButton()).toContainText('重新识别')
            await expect(recognize.exportButton()).toHaveAttribute('title', '导出')
            await expect(updater.titleMode()).toContainText('更新')
            await expect(updater.body()).toContainText('有可用更新')
            await expect(updater.body()).toContainText('更新日志')
            await expect(updater.body()).toContainText('下载链接')
            await expect(updater.laterButton()).toContainText('稍后提醒')
            await expect_tray_labels(omni, ['输入翻译', 'OCR 识别', '截图翻译', '剪贴板监听', '配置', '重启', '退出'])

            await translate.typeSource('hello world')
            await translate.clickTranslate()
            await expect(translate.detectedLanguage()).toContainText('检测为')
            await expect(translate.detectedLanguage()).toContainText('英文')
            await translate.selectTargetLanguage('ja')
            await expect(translate.targetLanguageButton()).toContainText('日语')
            await translate.selectTargetLanguage('zh_cn')
            await expect(translate.targetLanguageButton()).toContainText('简体中文')

            await config.select('cfg-app_language', 'en')
            await expect_config(omni, 'app_language', 'en')
            await expect(translate.sourceInput()).toHaveAttribute('placeholder', 'Enter text to translate...')
            await expect(translate.sourceLanguageButton()).toContainText('Auto Detect')
            await expect(translate.targetLanguageButton()).toContainText('Simplified Chinese')
            await translate.selectTargetLanguage('ja')
            await expect(translate.targetLanguageButton()).toContainText('Japanese')
            await translate.selectTargetLanguage('zh_cn')
            await expect(translate.targetLanguageButton()).toContainText('Simplified Chinese')
            await expect(translate.detectedLanguage()).toContainText('Detected as')
            await expect(translate.detectedLanguage()).toContainText('English')
            await expect(config.title()).toContainText('General')
            await expect(config.nav('hotkey')).toContainText('Hotkeys')
            await expect(config.setting('cfg-app_language')).toContainText('English')
            await expect(recognize.modeLabel()).toContainText('Recognize')
            await expect(recognize.languageSelect()).toContainText('Auto Detect')
            await expect(recognize.reRecognizeButton()).toContainText('Re-recognize')
            await expect(recognize.exportButton()).toHaveAttribute('title', 'Export')
            await expect(updater.titleMode()).toContainText('Update')
            await expect(updater.body()).toContainText('Update Available')
            await expect(updater.body()).toContainText('Changelog')
            await expect(updater.body()).toContainText('Downloads')
            await expect(updater.laterButton()).toContainText('Later')
            await expect_tray_labels(omni, ['Input Translate', 'OCR Recognize', 'Screenshot Translate', 'Clipboard Monitor', 'Config', 'Restart', 'Quit'])

            await config.select('cfg-app_language', 'zh_cn')
            await expect_config(omni, 'app_language', 'zh_cn')
            await expect(translate.sourceInput()).toHaveAttribute('placeholder', '输入要翻译的文本...')
            await expect(translate.sourceLanguageButton()).toContainText('自动检测')
            await expect(translate.targetLanguageButton()).toContainText('简体中文')
            await expect(translate.detectedLanguage()).toContainText('检测为')
            await expect(translate.detectedLanguage()).toContainText('英文')
            await expect(config.title()).toContainText('通用')
            await expect(config.nav('hotkey')).toContainText('快捷键')
            await expect(config.setting('cfg-app_language')).toContainText('简体中文')
            await expect(recognize.modeLabel()).toContainText('识别')
            await expect(recognize.languageSelect()).toContainText('自动检测')
            await expect(recognize.reRecognizeButton()).toContainText('重新识别')
            await expect(recognize.exportButton()).toHaveAttribute('title', '导出')
            await expect(updater.titleMode()).toContainText('更新')
            await expect(updater.body()).toContainText('有可用更新')
            await expect(updater.body()).toContainText('更新日志')
            await expect(updater.body()).toContainText('下载链接')
            await expect(updater.laterButton()).toContainText('稍后提醒')
            await expect_tray_labels(omni, ['输入翻译', 'OCR 识别', '截图翻译', '剪贴板监听', '配置', '重启', '退出'])
        } finally {
            await omni.stop()
        }
    })

    test('user sees fallback language text when a locale is missing a translation key', async () => {
        const omni = await AppFixture.start({ config: { ...BASE_CONFIG, app_language: 'nb_no' } })

        try {
            const translate = await omni.translate()
            const updater = await omni.mockUpdate(MOCK_RELEASE)

            await expect(translate.sourceLanguageButton()).toContainText('Auto Detect')
            await expect(translate.targetLanguageButton()).toContainText('Simplified Chinese')
            await translate.typeSource('hello world')
            await translate.clickTranslate()
            await expect(translate.detectedLanguage()).toContainText('Detected as', { timeout: 15_000 })
            await expect(translate.detectedLanguage()).toContainText('English')
            await expect(updater.body()).toContainText('Changelog')
            await expect(updater.laterButton()).toContainText('Later')
        } finally {
            await omni.stop()
        }
    })
})
