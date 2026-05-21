import React from 'react'
import { useTranslation } from 'react-i18next'
import { useConfig } from '../../hooks/use_config'
import { useConfigStore } from '../../stores/config_store'
import { native_language_options } from '../../i18n/language_names'
import { ocrServiceRegistry } from '../../services/registry'
import { getServiceKey } from '@shared/types/service'
import { LANGUAGE_CODES } from '@shared/types/language'
import { ConfigCard, ConfigRow, ConfigSwitch, ConfigSelect } from './config_components'

const ALL_LANGUAGES = LANGUAGE_CODES

export default function RecognizeSettings(): React.ReactElement {
    const { t } = useTranslation()
    const [engine, setEngine] = useConfig('recognize_engine')
    const [language, setLanguage] = useConfig('recognize_language')
    const [deleteNewline, setDeleteNewline] = useConfig('recognize_delete_newline')
    const [autoCopy, setAutoCopy] = useConfig('recognize_auto_copy')
    const config = useConfigStore((s) => s.config)
    const allLangOpts = native_language_options(t, ALL_LANGUAGES)
    const serviceEntries = Object.entries(config.service_instances)
    const engineOpts = config.recognize_service_list.flatMap((instanceKey) => {
        const instance = serviceEntries.find(([key]) => key === instanceKey)?.[1]
        if (!instance || instance.config.enable === false) return []
        const serviceKey = getServiceKey(instanceKey)
        const service = ocrServiceRegistry.get(serviceKey)
        return [{ value: instanceKey, label: service?.name ?? serviceKey }]
    })

    return (
        <div className="stack gap-12">
            <ConfigCard title={t('recognize.title', { defaultValue: '识别' })}>
                <ConfigRow label={t('recognize.engine', { defaultValue: '默认识别引擎' })}>
                    <ConfigSelect value={engine} onChange={setEngine} options={engineOpts} testId="cfg-recognize_engine" style={{ minWidth: 220 }} />
                </ConfigRow>
                <ConfigRow label={t('recognize.language', { defaultValue: '默认识别语言' })}>
                    <ConfigSelect value={language} onChange={setLanguage} options={allLangOpts} testId="cfg-recognize_language" style={{ minWidth: 220 }} />
                </ConfigRow>
                <ConfigRow label={t('recognize.delete_newline', { defaultValue: '自动去除换行' })}>
                    <ConfigSwitch on={deleteNewline} onChange={setDeleteNewline} testId="cfg-recognize_delete_newline" />
                </ConfigRow>
                <ConfigRow label={t('copy', { defaultValue: '自动复制' })}>
                    <ConfigSwitch on={autoCopy} onChange={setAutoCopy} testId="cfg-recognize_auto_copy" />
                </ConfigRow>
            </ConfigCard>
        </div>
    )
}
