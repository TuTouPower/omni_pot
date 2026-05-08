import React from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Label, Switch } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@shared/types/language'
import { SimpleSelect } from '../../components/simple_select'

const TARGET_LANGUAGES = LANGUAGE_CODES.filter((c) => c !== 'auto')
const ALL_LANGUAGES = LANGUAGE_CODES

const AUTO_COPY_OPTIONS = [
    { key: 'disable', label: 'Disable' },
    { key: 'source', label: 'Source text' },
    { key: 'target', label: 'Target text' },
    { key: 'source_target', label: 'Source + Target' }
]

const DETECT_ENGINES = [
    { key: 'bing', label: 'Bing' },
    { key: 'google', label: 'Google' },
    { key: 'baidu', label: 'Baidu' },
    { key: 'tencent', label: 'Tencent' },
    { key: 'niutrans', label: 'NiuTrans' },
    { key: 'local', label: 'Local (offline)' }
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

    const allLangItems = ALL_LANGUAGES.map((code) => ({ key: code, label: LANGUAGE_NAMES[code] }))
    const targetLangItems = TARGET_LANGUAGES.map((code) => ({ key: code, label: LANGUAGE_NAMES[code] }))

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">{t('translate_settings.title')}</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <SimpleSelect label={t('translate_settings.source_language')} value={sourceLang} onChange={setSourceLang} options={allLangItems} />
                    <SimpleSelect label={t('translate_settings.target_language')} value={targetLang} onChange={setTargetLang} options={targetLangItems} />
                    <SimpleSelect label={t('translate_settings.second_language')} value={secondLang} onChange={setSecondLang} options={targetLangItems} />
                    <SimpleSelect label={t('translate_settings.detect_engine')} value={detectEngine} onChange={setDetectEngine} options={DETECT_ENGINES} />
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <SimpleSelect label={t('translate_settings.auto_copy')} value={autoCopy} onChange={(v) => setAutoCopy(v)} options={AUTO_COPY_OPTIONS} />
                    <Switch isSelected={deleteNewline} onChange={setDeleteNewline}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">{t('translate_settings.delete_newline')}</Label></Switch.Content>
                    </Switch>
                    <Switch isSelected={incremental} onChange={setIncremental}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">{t('translate_settings.incremental_translate')}</Label></Switch.Content>
                    </Switch>
                </Card.Content>
            </Card>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <Switch isSelected={closeOnBlur} onChange={setCloseOnBlur}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">{t('translate_settings.close_on_blur')}</Label></Switch.Content>
                    </Switch>
                    <Switch isSelected={alwaysOnTop} onChange={setAlwaysOnTop}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">{t('translate_settings.always_on_top')}</Label></Switch.Content>
                    </Switch>
                    <Switch isSelected={hideSource} onChange={setHideSource}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">{t('translate_settings.hide_source')}</Label></Switch.Content>
                    </Switch>
                    <Switch isSelected={hideLanguage} onChange={setHideLanguage}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">{t('translate_settings.hide_language')}</Label></Switch.Content>
                    </Switch>
                    <Switch isSelected={rememberWindowSize} onChange={setRememberWindowSize}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                        <Switch.Content><Label className="text-sm">{t('translate_settings.remember_window_size')}</Label></Switch.Content>
                    </Switch>
                </Card.Content>
            </Card>
        </div>
    )
}
