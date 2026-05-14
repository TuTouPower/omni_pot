import React from 'react'
import { useTranslation } from 'react-i18next'
import { useConfig } from '../../hooks/use_config'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'
import { ConfigCard, ConfigRow, ConfigSwitch, ConfigSelect } from './config_components'

const ALL_LANGUAGES = LANGUAGE_CODES.map((code) => ({ value: code, label: LANGUAGE_NAMES[code] }))

export default function RecognizeSettings(): React.ReactElement {
    const { t } = useTranslation()
    const [language, setLanguage] = useConfig('recognize_language')
    const [deleteNewline, setDeleteNewline] = useConfig('recognize_delete_newline')
    const [autoCopy, setAutoCopy] = useConfig('recognize_auto_copy')
    const [closeOnBlur, setCloseOnBlur] = useConfig('recognize_close_on_blur')
    const [hideWindow, setHideWindow] = useConfig('recognize_hide_window')

    return (
        <div className="stack gap-12">
            <ConfigCard title={t('recognize.title') || '识别'}>
                <ConfigRow label={t('recognize.language') || '默认识别语言'}>
                    <ConfigSelect value={language} onChange={setLanguage} options={ALL_LANGUAGES} style={{ minWidth: 180 }} />
                </ConfigRow>
                <ConfigRow label={t('recognize.delete_newline') || '自动去除换行'}>
                    <ConfigSwitch on={deleteNewline} onChange={setDeleteNewline} />
                </ConfigRow>
                <ConfigRow label={t('copy') || '自动复制结果'}>
                    <ConfigSwitch on={autoCopy} onChange={setAutoCopy} />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.close_on_blur') || '失焦时关闭'}>
                    <ConfigSwitch on={closeOnBlur} onChange={setCloseOnBlur} />
                </ConfigRow>
                <ConfigRow label={t('translate_settings.hide_source') || '识别后隐藏窗口'}>
                    <ConfigSwitch on={hideWindow} onChange={setHideWindow} />
                </ConfigRow>
            </ConfigCard>
        </div>
    )
}
