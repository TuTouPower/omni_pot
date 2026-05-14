import React from 'react'
import { useTranslation } from 'react-i18next'
import { useConfig } from '../../hooks/use_config'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'
import { ConfigCard, ConfigRow, ConfigSwitch, ConfigSelect } from './config_components'

const ALL_LANGUAGES = LANGUAGE_CODES
const TARGET_LANGUAGES = LANGUAGE_CODES.filter((c) => c !== 'auto')

const AUTO_COPY_OPTIONS = [
    { value: 'disable' as const, label: '关闭' },
    { value: 'source' as const, label: '源文本' },
    { value: 'target' as const, label: '第一个译文' },
    { value: 'source_target' as const, label: '源 + 译文' },
]

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
    const [closeOnBlur, setCloseOnBlur] = useConfig('translate_close_on_blur')
    const [alwaysOnTop, setAlwaysOnTop] = useConfig('translate_always_on_top')
    const [hideSource, setHideSource] = useConfig('hide_source')
    const [hideLanguage, setHideLanguage] = useConfig('hide_language')
    const [rememberWindowSize, setRememberWindowSize] = useConfig('translate_remember_window_size')

    const allLangOpts = ALL_LANGUAGES.map((code) => ({ value: code, label: LANGUAGE_NAMES[code] }))
    const targetLangOpts = TARGET_LANGUAGES.map((code) => ({ value: code, label: LANGUAGE_NAMES[code] }))

    return (
        <div className="stack gap-12">
            <ConfigCard title={t('translate_settings.language') || '语言'}>
                <ConfigRow label={t('translate_settings.source_language') || '源语言'}>
                    <ConfigSelect value={sourceLang} onChange={setSourceLang} options={allLangOpts} testId="cfg-translate_source_language" style={{ minWidth: 180 }} />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.target_language') || '目标语言'}>
                    <ConfigSelect value={targetLang} onChange={setTargetLang} options={targetLangOpts} testId="cfg-translate_target_language" style={{ minWidth: 180 }} />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.second_language') || '第二语言'} sub="检测到目标语言相同时切换到此语言">
                    <ConfigSelect value={secondLang} onChange={setSecondLang} options={targetLangOpts} testId="cfg-translate_second_language" style={{ minWidth: 180 }} />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.detect_engine') || '检测引擎'}>
                    <ConfigSelect value={detectEngine} onChange={setDetectEngine} options={DETECT_ENGINES} testId="cfg-translate_detect_engine" style={{ minWidth: 180 }} />
                </ConfigRow>
            </ConfigCard>

            <ConfigCard title={t('translate_settings.behavior') || '行为'}>
                <ConfigRow label={t('translate_settings.auto_copy') || '自动复制'}>
                    <ConfigSelect value={autoCopy as 'disable' | 'source' | 'target' | 'source_target'} onChange={setAutoCopy as (v: 'disable' | 'source' | 'target' | 'source_target') => void} options={AUTO_COPY_OPTIONS} testId="cfg-translate_auto_copy" style={{ minWidth: 180 }} />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.incremental_translate') || '增量翻译'} sub="新选取的文本追加到现有源文本而非替换">
                    <ConfigSwitch on={incremental} onChange={setIncremental} testId="cfg-incremental_translate" />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.delete_newline') || '自动去除换行'}>
                    <ConfigSwitch on={deleteNewline} onChange={setDeleteNewline} testId="cfg-translate_delete_newline" />
                </ConfigRow>
            </ConfigCard>

            <ConfigCard title={t('translate_settings.window') || '窗口'}>
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
                <ConfigRow label={t('translate_settings.remember_window_size') || '记住窗口大小'}>
                    <ConfigSwitch on={rememberWindowSize} onChange={setRememberWindowSize} testId="cfg-translate_remember_window_size" />
                </ConfigRow>
            </ConfigCard>
        </div>
    )
}
