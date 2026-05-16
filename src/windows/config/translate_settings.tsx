import React from 'react'
import { useTranslation } from 'react-i18next'
import { useConfig } from '../../hooks/use_config'
import { language_options } from '../../i18n/language_names'
import { LANGUAGE_CODES } from '@shared/types/language'
import { ConfigCard, ConfigRow, ConfigSwitch, ConfigSelect } from './config_components'

const ALL_LANGUAGES = LANGUAGE_CODES
const TARGET_LANGUAGES = LANGUAGE_CODES.filter((c) => c !== 'auto')

const AUTO_COPY_VALUES = ['disable', 'source', 'target', 'source_target'] as const

const AUTO_COPY_LABEL_KEYS: Record<typeof AUTO_COPY_VALUES[number], string> = {
    disable: 'translate_settings.auto_copy_disable',
    source: 'translate_settings.auto_copy_source',
    target: 'translate_settings.auto_copy_target',
    source_target: 'translate_settings.auto_copy_both',
}

const DETECT_ENGINES = [
    { value: 'bing', label: 'Bing' },
    { value: 'google', label: 'Google' },
    { value: 'baidu', label: '百度' },
    { value: 'tencent', label: '腾讯' },
    { value: 'niutrans', label: '牛翻译' },
    { value: 'local', label: '本地 (Lingua)' },
]

export default function TranslatePage(): React.ReactElement {
    const { t } = useTranslation()
    const [sourceLang, setSourceLang] = useConfig('translate_source_language')
    const [targetLang, setTargetLang] = useConfig('translate_target_language')
    const [secondLang, setSecondLang] = useConfig('translate_second_language')
    const [detectEngine, setDetectEngine] = useConfig('translate_detect_engine')
    const [autoCopy, setAutoCopy] = useConfig('translate_auto_copy')
    const [deleteNewline, setDeleteNewline] = useConfig('translate_delete_newline')
    const [incremental, setIncremental] = useConfig('incremental_translate')
    const [dynamicTranslate, setDynamicTranslate] = useConfig('dynamic_translate')
    const [rememberLanguage, setRememberLanguage] = useConfig('translate_remember_language')
    const [historyDisable, setHistoryDisable] = useConfig('history_disable')
    const [windowPosition, setWindowPosition] = useConfig('translate_window_position')
    const [closeOnBlur, setCloseOnBlur] = useConfig('translate_close_on_blur')
    const [alwaysOnTop, setAlwaysOnTop] = useConfig('translate_always_on_top')
    const [hideSource, setHideSource] = useConfig('hide_source')
    const [hideLanguage, setHideLanguage] = useConfig('hide_language')
    const [rememberWindowSize, setRememberWindowSize] = useConfig('translate_remember_window_size')
    const [hideWindow, setHideWindow] = useConfig('translate_hide_window')

    const allLangOpts = language_options(t, ALL_LANGUAGES)
    const targetLangOpts = language_options(t, TARGET_LANGUAGES)
    const autoCopyOpts = AUTO_COPY_VALUES.map((value) => ({ value, label: t(AUTO_COPY_LABEL_KEYS[value]) }))
    const windowPositionOpts: { value: 'mouse' | 'pre_state'; label: string }[] = [
        { value: 'mouse', label: t('translate_settings.window_position_mouse') },
        { value: 'pre_state', label: t('translate_settings.window_position_pre_state') },
    ]

    return (
        <div className="stack gap-12">
            <ConfigCard title={t('translate_settings.language') || '语言'}>
                <ConfigRow label={t('translate_settings.source_language') || '源语言'}>
                    <ConfigSelect value={sourceLang} onChange={setSourceLang} options={allLangOpts} testId="cfg-translate_source_language" style={{ minWidth: 180 }} />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.target_language') || '目标语言'}>
                    <ConfigSelect value={targetLang} onChange={setTargetLang} options={targetLangOpts} testId="cfg-translate_target_language" style={{ minWidth: 180 }} />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.second_language') || '第二语言'} sub={t('translate_settings.second_language_sub')}>
                    <ConfigSelect value={secondLang} onChange={setSecondLang} options={targetLangOpts} testId="cfg-translate_second_language" style={{ minWidth: 180 }} />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.detect_engine') || '检测引擎'}>
                    <ConfigSelect value={detectEngine} onChange={setDetectEngine} options={DETECT_ENGINES} testId="cfg-translate_detect_engine" style={{ minWidth: 180 }} />
                </ConfigRow>
            </ConfigCard>

            <ConfigCard title={t('translate_settings.behavior') || '行为'}>
                <ConfigRow label={t('translate_settings.auto_copy') || '自动复制'}>
                    <ConfigSelect value={autoCopy} onChange={setAutoCopy} options={autoCopyOpts} testId="cfg-translate_auto_copy" style={{ minWidth: 180 }} />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.incremental_translate') || '增量翻译'} sub={t('translate_settings.incremental_translate_sub')}>
                    <ConfigSwitch on={incremental} onChange={setIncremental} testId="cfg-incremental_translate" />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.dynamic_translate') || '动态翻译'} sub={t('translate_settings.dynamic_translate_sub')}>
                    <ConfigSwitch on={dynamicTranslate} onChange={setDynamicTranslate} testId="cfg-dynamic_translate" />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.delete_newline') || '自动去除换行'}>
                    <ConfigSwitch on={deleteNewline} onChange={setDeleteNewline} testId="cfg-translate_delete_newline" />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.remember_language', { defaultValue: '记住语言选择' })}>
                    <ConfigSwitch on={rememberLanguage} onChange={setRememberLanguage} testId="cfg-translate_remember_language" />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.history_disable', { defaultValue: '禁用历史记录' })}>
                    <ConfigSwitch on={historyDisable} onChange={setHistoryDisable} testId="cfg-history_disable" />
                </ConfigRow>
            </ConfigCard>

            <ConfigCard title={t('translate_settings.window') || '窗口'}>
                <ConfigRow label={t('translate_settings.window_position', { defaultValue: '窗口位置' })}>
                    <ConfigSelect value={windowPosition} onChange={setWindowPosition} options={windowPositionOpts} testId="cfg-translate_window_position" style={{ minWidth: 160 }} />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.remember_window_size') || '记住窗口大小'}>
                    <ConfigSwitch on={rememberWindowSize} onChange={setRememberWindowSize} testId="cfg-translate_remember_window_size" />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.close_on_blur') || '失焦时关闭'}>
                    <ConfigSwitch on={closeOnBlur} onChange={setCloseOnBlur} testId="cfg-translate_close_on_blur" />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.always_on_top') || '始终置顶'}>
                    <ConfigSwitch on={alwaysOnTop} onChange={setAlwaysOnTop} testId="cfg-translate_always_on_top" />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.hide_source') || '隐藏源文本'}>
                    <ConfigSwitch on={hideSource} onChange={setHideSource} testId="cfg-hide_source" />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.hide_language') || '隐藏语言选择'}>
                    <ConfigSwitch on={hideLanguage} onChange={setHideLanguage} testId="cfg-hide_language" />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.hide_window', { defaultValue: '翻译后隐藏窗口' })} sub={t('translate_settings.hide_window_sub')}>
                    <ConfigSwitch on={hideWindow} onChange={setHideWindow} testId="cfg-translate_hide_window" />
                </ConfigRow>
            </ConfigCard>
        </div>
    )
}
