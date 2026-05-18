import React from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfigStore } from '../../stores/config_store'
import { format_hotkey } from '../../utils/format_hotkey'

type HintIcon = 'translate' | 'type' | 'camera' | 'image'

interface HintItem {
    icon: HintIcon
    title_key: string
    title_fallback: string
    sub_key: string
    sub_fallback: string
    hotkey_value: string
    test_id: string
}

function HintRow({ item }: { item: HintItem }): React.ReactElement {
    const { t } = useTranslation()
    const keys = format_hotkey(item.hotkey_value)
    const IconComp = item.icon === 'translate' ? Icons.Translate
        : item.icon === 'type' ? Icons.Type
        : item.icon === 'camera' ? Icons.Camera
        : Icons.Image
    return (
        <div className="card" data-testid={item.test_id} style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)',
                display: 'grid', placeItems: 'center', flex: '0 0 30px'
            }}>
                <IconComp size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t(item.title_key, { defaultValue: item.title_fallback })}</div>
                <div className="hint" style={{ marginTop: 1 }}>{t(item.sub_key, { defaultValue: item.sub_fallback })}</div>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
                {keys.length === 0 && (
                    <span className="hint mono" data-testid={`${item.test_id}-unset`}>{t('welcome.not_set', { defaultValue: '未设置' })}</span>
                )}
                {keys.map((k, i) => <kbd key={i} style={{ fontSize: 10.5 }}>{k}</kbd>)}
            </div>
        </div>
    )
}

interface WelcomeEmptyProps {
    onSkip: () => void
}

export default function WelcomeEmpty({ onSkip }: WelcomeEmptyProps): React.ReactElement {
    const { t } = useTranslation()
    const hotkey_translate = useConfigStore((s) => s.config.hotkey_translate)
    const hotkey_ocr_recognize = useConfigStore((s) => s.config.hotkey_ocr_recognize)
    const hotkey_ocr_translate = useConfigStore((s) => s.config.hotkey_ocr_translate)

    const items: HintItem[] = [
        {
            icon: 'translate',
            title_key: 'welcome.translate',
            title_fallback: '翻译',
            sub_key: 'welcome.translate_sub',
            sub_fallback: '选中文本自动翻译，未选中则打开输入窗口',
            hotkey_value: hotkey_translate,
            test_id: 'welcome-translate',
        },
        {
            icon: 'camera',
            title_key: 'welcome.ocr_recognize',
            title_fallback: '文字识别',
            sub_key: 'welcome.ocr_recognize_sub',
            sub_fallback: '截图后将文字提取到识别窗口',
            hotkey_value: hotkey_ocr_recognize,
            test_id: 'welcome-ocr-recognize',
        },
        {
            icon: 'image',
            title_key: 'welcome.ocr_translate',
            title_fallback: '截图翻译',
            sub_key: 'welcome.ocr_translate_sub',
            sub_fallback: '截图、识别并直接翻译结果',
            hotkey_value: hotkey_ocr_translate,
            test_id: 'welcome-ocr-translate',
        },
    ]

    const handle_open_hotkey = (): void => {
        window.electronAPI.window.openConfig('hotkey').catch(console.error)
        window.electronAPI.window.close().catch(console.error)
    }

    return (
        <div data-testid="welcome-empty" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '6px 4px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="svc-tile" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--brand-primary)', color: '#fff', borderColor: 'transparent', fontSize: 12 }}>op</div>
                <div className="stack">
                    <div style={{ fontSize: 14, fontWeight: 600 }} data-testid="welcome-title">{t('welcome.title', { defaultValue: '欢迎使用 Omni Pot' })}</div>
                    <div className="hint">{t('welcome.subtitle', { defaultValue: '下面的快捷键已为你预设，随时可在「设置」中修改' })}</div>
                </div>
            </div>
            {items.map((it) => <HintRow key={it.test_id} item={it} />)}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn sm" data-testid="welcome-configure-hotkeys" onClick={handle_open_hotkey}>
                    <Icons.Settings size={13} />
                    {t('welcome.configure_hotkeys', { defaultValue: '设置快捷键' })}
                </button>
                <button className="btn sm" data-testid="welcome-skip" style={{ color: 'var(--brand-primary)' }} onClick={onSkip}>
                    {t('welcome.skip', { defaultValue: '跳过' })}
                </button>
            </div>
        </div>
    )
}
