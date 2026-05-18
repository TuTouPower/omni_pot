import React from 'react'
import { useTranslation } from 'react-i18next'
import { useConfig } from '../../hooks/use_config'
import { native_language_options } from '../../i18n/language_names'
import { LANGUAGE_CODES } from '@shared/types/language'
import { ConfigCard, ConfigRow, ConfigSwitch, ConfigSelect } from './config_components'

const ALL_LANGUAGES = LANGUAGE_CODES

export default function RecognizeSettings(): React.ReactElement {
    const { t } = useTranslation()
    const [language, setLanguage] = useConfig('recognize_language')
    const [deleteNewline, setDeleteNewline] = useConfig('recognize_delete_newline')
    const [autoCopy, setAutoCopy] = useConfig('recognize_auto_copy')
    const [hideWindow, setHideWindow] = useConfig('recognize_hide_window')
    const allLangOpts = native_language_options(t, ALL_LANGUAGES)

    return (
        <div className="stack gap-12">
            <ConfigCard title={t('recognize.title', { defaultValue: '识别' })}>
                <ConfigRow label={t('recognize.language', { defaultValue: '默认识别语言' })}>
                    <ConfigSelect value={language} onChange={setLanguage} options={allLangOpts} testId="cfg-recognize_language" style={{ minWidth: 180 }} />
                </ConfigRow>
                <ConfigRow label={t('recognize.delete_newline', { defaultValue: '自动去除换行' })}>
                    <ConfigSwitch on={deleteNewline} onChange={setDeleteNewline} testId="cfg-recognize_delete_newline" />
                </ConfigRow>
                <ConfigRow label={t('copy', { defaultValue: '自动复制结果' })}>
                    <ConfigSwitch on={autoCopy} onChange={setAutoCopy} testId="cfg-recognize_auto_copy" />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.hide_source', { defaultValue: '识别后隐藏窗口' })}>
                    <ConfigSwitch on={hideWindow} onChange={setHideWindow} testId="cfg-recognize_hide_window" />
                </ConfigRow>
            </ConfigCard>
        </div>
    )
}
