import React from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfigStore } from '../../stores/config_store'

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

function render_hotkey(value: string): string[] {
    if (!value) return []
    return value.split('+').map((seg) => seg.trim()).filter(Boolean)
}

function HintRow({ item }: { item: HintItem }): React.ReactElement {
    const { t } = useTranslation()
    const keys = render_hotkey(item.hotkey_value)
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
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t(item.title_key) || item.title_fallback}</div>
                <div className="hint" style={{ marginTop: 1 }}>{t(item.sub_key) || item.sub_fallback}</div>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
                {keys.length === 0 && (
                    <span className="hint mono" data-testid={`${item.test_id}-unset`}>{t('welcome.not_set') || '未设置'}</span>
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
    const hotkey_selection_translate = useConfigStore((s) => s.config.hotkey_selection_translate)
    const hotkey_input_translate = useConfigStore((s) => s.config.hotkey_input_translate)
    const hotkey_ocr_recognize = useConfigStore((s) => s.config.hotkey_ocr_recognize)
    const hotkey_ocr_translate = useConfigStore((s) => s.config.hotkey_ocr_translate)

    const items: HintItem[] = [
        {
            icon: 'translate',
            title_key: 'welcome.selection_translate',
            title_fallback: '划词翻译',
            sub_key: 'welcome.selection_translate_sub',
            sub_fallback: '选中文本后按下快捷键即翻译',
            hotkey_value: hotkey_selection_translate,
            test_id: 'welcome-selection-translate',
        },
        {
            icon: 'type',
            title_key: 'welcome.input_translate',
            title_fallback: '输入翻译',
            sub_key: 'welcome.input_translate_sub',
            sub_fallback: '呼出窗口手动输入要翻译的文本',
            hotkey_value: hotkey_input_translate,
            test_id: 'welcome-input-translate',
        },
        {
            icon: 'camera',
            title_key: 'welcome.ocr_recognize',
            title_fallback: 'OCR 识别',
            sub_key: 'welcome.ocr_recognize_sub',
            sub_fallback: '截图后将文字提取到识别窗口',
            hotkey_value: hotkey_ocr_recognize,
            test_id: 'welcome-ocr-recognize',
        },
        {
            icon: 'image',
            title_key: 'welcome.ocr_translate',
            title_fallback: 'OCR 翻译',
            sub_key: 'welcome.ocr_translate_sub',
            sub_fallback: '截图、识别并直接翻译结果',
            hotkey_value: hotkey_ocr_translate,
            test_id: 'welcome-ocr-translate',
        },
    ]

    const handle_open_hotkey = (): void => {
        window.electronAPI.window.openConfig('hotkey').catch(console.error)
    }

    return (
        <div data-testid="welcome-empty" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '6px 4px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="svc-tile" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--brand-primary)', color: '#fff', borderColor: 'transparent', fontSize: 12 }}>op</div>
                <div className="stack">
                    <div style={{ fontSize: 14, fontWeight: 600 }} data-testid="welcome-title">{t('welcome.title') || '欢迎使用 Omni Pot'}</div>
                    <div className="hint">{t('welcome.subtitle') || '下面的快捷键已为你预设，随时可在「设置」中修改'}</div>
                </div>
            </div>
            {items.map((it) => <HintRow key={it.test_id} item={it} />)}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn sm" data-testid="welcome-configure-hotkeys" onClick={handle_open_hotkey}>
                    <Icons.Settings size={13} />
                    {t('welcome.configure_hotkeys') || '配置快捷键'}
                </button>
                <button className="btn sm" data-testid="welcome-skip" style={{ color: 'var(--brand-primary)' }} onClick={onSkip}>
                    {t('welcome.skip') || '跳过'}
                </button>
            </div>
        </div>
    )
}
