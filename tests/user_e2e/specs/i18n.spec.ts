import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import en_locale from '../../../src/i18n/locales/en.json'
import zh_cn_locale from '../../../src/i18n/locales/zh_cn.json'
import { local_translation_timeout_ms } from '../fixtures/timeout_constants'

const NATIVE_LANGUAGE_NAMES = {
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    zh_cn: '简体中文',
}

const ZH_CN_TRAY_LABELS = ['翻译', '词典', '文字识别', '截图翻译', '剪贴板监听', '设置', '支持作者', '检查更新', '查看日志', '重启', '退出']
const EN_TRAY_LABELS = ['Translate', 'Dictionary', 'Text Recognize', 'Screenshot Translate', 'Clipboard Monitor', 'Settings', 'Support Author', 'Check Updates', 'View Logs', 'Restart', 'Quit']

const BASE_CONFIG = {
    check_update: false,
    dynamic_translate: false,
    translate_service_list: [],
    translate_source_language: 'auto',
    translate_target_language: 'zh_cn',
    welcome_dismissed: true,
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
    test('language dropdown lists use native names regardless of interface language', async () => {
        // Spec: every language picker shows the language's OWN native name
        // (日本語, 한국어, English, 简体中文), not a translated label that varies
        // with the interface language.
        const omni = await AppFixture.start({ config: { ...BASE_CONFIG, app_language: 'zh_cn' } })
        try {
            const translate = await omni.translate()
            const page = translate.sourceInput().page()
            await translate.targetLanguageButton().click()
            await expect(page.getByTestId('lang-target-option-ja')).toContainText(NATIVE_LANGUAGE_NAMES.ja)
            await expect(page.getByTestId('lang-target-option-ko')).toContainText(NATIVE_LANGUAGE_NAMES.ko)
            await expect(page.getByTestId('lang-target-option-en')).toContainText(NATIVE_LANGUAGE_NAMES.en)
            await expect(page.getByTestId('lang-target-option-zh_cn')).toContainText(NATIVE_LANGUAGE_NAMES.zh_cn)
        } finally {
            await omni.stop()
        }
    })

    test('user switches interface language and already-open windows update immediately', async () => {
        const omni = await AppFixture.start({ config: { ...BASE_CONFIG, app_language: 'zh_cn', translate_always_on_top: true } })

        try {
            const translate = await omni.translate()
            // Pin translate so it survives blur when config opens.
            await translate.clickPin()
            const config = await omni.openConfig()
            // Open recognize before updater — recognize auto-closes on blur
            // when the updater steals focus, so check its labels first.
            const recognize = await omni.openRecognize()

            await expect(translate.sourceInput()).toHaveAttribute('placeholder', zh_cn_locale.source_placeholder)
            await expect(translate.sourceLanguageButton()).toContainText(zh_cn_locale.languages.auto)
            await expect(translate.targetLanguageButton()).toContainText(NATIVE_LANGUAGE_NAMES.zh_cn)
            await expect(config.title()).toContainText(zh_cn_locale.general.title)
            await expect(config.nav('hotkey')).toContainText(zh_cn_locale.hotkey.title)
            await expect(config.setting('cfg-app_language')).toContainText(zh_cn_locale.general.app_language_zh_cn)
            await expect(recognize.modeLabel()).toContainText(zh_cn_locale.recognize.title)
            await expect(recognize.languageSelect()).toContainText(zh_cn_locale.languages.auto)
            await expect(recognize.exportButton()).toHaveAttribute('title', zh_cn_locale.recognize.export)

            // Updater opens after recognize — recognize will close on blur.
            const updater = await omni.mockUpdate(MOCK_RELEASE)
            await expect(updater.titleMode()).toContainText(zh_cn_locale.updater.title)
            await expect(updater.body()).toContainText(zh_cn_locale.update_available)
            await expect(updater.body()).toContainText(zh_cn_locale.changelog)
            await expect(updater.body()).toContainText(zh_cn_locale.downloads)
            await expect(updater.laterButton()).toContainText(zh_cn_locale.update_later)
            await expect_tray_labels(omni, ZH_CN_TRAY_LABELS)

            await translate.typeSource('hello world')
            await translate.clickTranslate()
            await expect(translate.detectedLanguage()).toContainText(zh_cn_locale.detected_language_prefix)
            // Native name (English) shown even when interface is Chinese, per spec.
            await expect(translate.detectedLanguage()).toContainText(NATIVE_LANGUAGE_NAMES.en)
            await translate.selectTargetLanguage('ja')
            await expect(translate.targetLanguageButton()).toContainText(NATIVE_LANGUAGE_NAMES.ja)
            await translate.selectTargetLanguage('zh_cn')
            await expect(translate.targetLanguageButton()).toContainText(NATIVE_LANGUAGE_NAMES.zh_cn)

            await config.select('cfg-app_language', 'en')
            await expect_config(omni, 'app_language', 'en')
            await expect(translate.sourceInput()).toHaveAttribute('placeholder', en_locale.source_placeholder)
            await expect(translate.sourceLanguageButton()).toContainText(en_locale.languages.auto)
            // Target keeps the native name regardless of interface language.
            await expect(translate.targetLanguageButton()).toContainText(NATIVE_LANGUAGE_NAMES.zh_cn)
            await translate.selectTargetLanguage('ja')
            await expect(translate.targetLanguageButton()).toContainText(NATIVE_LANGUAGE_NAMES.ja)
            await translate.selectTargetLanguage('zh_cn')
            await expect(translate.targetLanguageButton()).toContainText(NATIVE_LANGUAGE_NAMES.zh_cn)
            await expect(translate.detectedLanguage()).toContainText(en_locale.detected_language_prefix)
            await expect(translate.detectedLanguage()).toContainText(NATIVE_LANGUAGE_NAMES.en)
            await expect(config.title()).toContainText(en_locale.general.title)
            await expect(config.nav('hotkey')).toContainText(en_locale.hotkey.title)
            await expect(config.setting('cfg-app_language')).toContainText(en_locale.general.app_language_en)
            // Reopen recognize after language switch (it closed on blur when updater opened).
            const recognize_en = await omni.openRecognize()
            await expect(recognize_en.modeLabel()).toContainText(en_locale.recognize.title)
            await expect(recognize_en.languageSelect()).toContainText(en_locale.languages.auto)
            await expect(recognize_en.exportButton()).toHaveAttribute('title', en_locale.recognize.export)
            await expect_tray_labels(omni, EN_TRAY_LABELS)

            await config.select('cfg-app_language', 'zh_cn')
            await expect_config(omni, 'app_language', 'zh_cn')
            await expect(translate.sourceInput()).toHaveAttribute('placeholder', zh_cn_locale.source_placeholder)
            await expect(translate.sourceLanguageButton()).toContainText(zh_cn_locale.languages.auto)
            await expect(translate.targetLanguageButton()).toContainText(NATIVE_LANGUAGE_NAMES.zh_cn)
            await expect(translate.detectedLanguage()).toContainText(zh_cn_locale.detected_language_prefix)
            await expect(translate.detectedLanguage()).toContainText(NATIVE_LANGUAGE_NAMES.en)
            await expect(config.title()).toContainText(zh_cn_locale.general.title)
            await expect(config.nav('hotkey')).toContainText(zh_cn_locale.hotkey.title)
            await expect(config.setting('cfg-app_language')).toContainText(zh_cn_locale.general.app_language_zh_cn)
            // Reopen recognize again for zh_cn assertions.
            const recognize_zh = await omni.openRecognize()
            await expect(recognize_zh.modeLabel()).toContainText(zh_cn_locale.recognize.title)
            await expect(recognize_zh.languageSelect()).toContainText(zh_cn_locale.languages.auto)
            await expect(recognize_zh.exportButton()).toHaveAttribute('title', zh_cn_locale.recognize.export)
            await expect_tray_labels(omni, ZH_CN_TRAY_LABELS)
        } finally {
            await omni.stop()
        }
    })

    test('user sees fallback language text when a locale is missing a translation key', async () => {
        const omni = await AppFixture.start({ config: { ...BASE_CONFIG, app_language: 'nb_no', translate_always_on_top: true } })

        try {
            const translate = await omni.translate()
            await translate.clickPin()
            const updater = await omni.mockUpdate(MOCK_RELEASE)

            await expect(translate.sourceLanguageButton()).toContainText(en_locale.languages.auto)
            await expect(translate.targetLanguageButton()).toContainText(NATIVE_LANGUAGE_NAMES.zh_cn)
            await translate.typeSource('hello world')
            await translate.clickTranslate()
            await expect(translate.detectedLanguage()).toContainText(en_locale.detected_language_prefix, { timeout: local_translation_timeout_ms })
            await expect(translate.detectedLanguage()).toContainText(NATIVE_LANGUAGE_NAMES.en)
            await expect(updater.body()).toContainText(en_locale.changelog)
            await expect(updater.laterButton()).toContainText(en_locale.update_later)

            // Spec §28: 缺失 key 必须显示明确 fallback，不展示原始翻译 key。
            const page = translate.sourceInput().page()
            await expect(page.locator('body')).not.toContainText('welcome.translate')
            await expect(page.locator('body')).not.toContainText('Delete_spaces')
            await expect(page.locator('body')).not.toContainText('Delete_newline')
            await expect(page.locator('body')).not.toContainText('source.copy')
            await expect(page.locator('body')).not.toContainText('source.clear')
        } finally {
            await omni.stop()
        }
    })
})
