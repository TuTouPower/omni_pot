import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfigStore } from '../../stores/config_store'
import { format_hotkey } from '../../utils/format_hotkey'
import { create_logger } from '../../utils/logger'

const log = create_logger('welcome')

type HintIcon = 'translate' | 'type' | 'camera' | 'image' | 'search'
type WelcomeAction = 'translate' | 'dictionary' | 'ocr_recognize' | 'ocr_translate'

interface HintItem {
    icon: HintIcon
    action: WelcomeAction
    title_key: string
    title_fallback: string
    sub_key: string
    sub_fallback: string
    hotkey_value: string
    test_id: string
}

function HintRow({ item, onAction }: { item: HintItem; onAction: (action: WelcomeAction) => void }): React.ReactElement {
    const { t } = useTranslation()
    const keys = format_hotkey(item.hotkey_value)
    const IconComp = item.icon === 'translate' ? Icons.Translate
        : item.icon === 'type' ? Icons.Type
        : item.icon === 'camera' ? Icons.Camera
        : item.icon === 'search' ? Icons.Search
        : Icons.Image
    return (
        <button
            className="card"
            data-testid={item.test_id}
            onClick={() => { onAction(item.action); }}
            style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer' }}
        >
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
        </button>
    )
}

export default function WelcomeWindow(): React.ReactElement {
    const { t } = useTranslation()
    const hotkey_translate = useConfigStore((s) => s.config.hotkey_translate)
    const hotkey_selection_dictionary = useConfigStore((s) => s.config.hotkey_selection_dictionary)
    const hotkey_ocr_recognize = useConfigStore((s) => s.config.hotkey_ocr_recognize)
    const hotkey_ocr_translate = useConfigStore((s) => s.config.hotkey_ocr_translate)
    const titlebar_ref = useRef<HTMLDivElement>(null)
    const main_ref = useRef<HTMLElement>(null)

    const items: HintItem[] = useMemo(() => [
        {
            icon: 'translate',
            action: 'translate',
            title_key: 'welcome.translate',
            title_fallback: '翻译',
            sub_key: 'welcome.translate_sub',
            sub_fallback: '选中文本自动翻译，未选中则打开输入窗口',
            hotkey_value: hotkey_translate,
            test_id: 'welcome-translate',
        },
        {
            icon: 'search',
            action: 'dictionary',
            title_key: 'welcome.dictionary',
            title_fallback: '词典',
            sub_key: 'welcome.dictionary_sub',
            sub_fallback: '选中字词查询词典',
            hotkey_value: hotkey_selection_dictionary,
            test_id: 'welcome-dictionary',
        },
        {
            icon: 'camera',
            action: 'ocr_recognize',
            title_key: 'welcome.ocr_recognize',
            title_fallback: '文字识别',
            sub_key: 'welcome.ocr_recognize_sub',
            sub_fallback: '截图后将文字提取到识别窗口',
            hotkey_value: hotkey_ocr_recognize,
            test_id: 'welcome-ocr-recognize',
        },
        {
            icon: 'image',
            action: 'ocr_translate',
            title_key: 'welcome.ocr_translate',
            title_fallback: '截图翻译',
            sub_key: 'welcome.ocr_translate_sub',
            sub_fallback: '截图、识别并直接翻译结果',
            hotkey_value: hotkey_ocr_translate,
            test_id: 'welcome-ocr-translate',
        },
    ], [hotkey_translate, hotkey_selection_dictionary, hotkey_ocr_recognize, hotkey_ocr_translate])

    useLayoutEffect(() => {
        const resize_to_content = (): void => {
            const titlebar = titlebar_ref.current
            const main = main_ref.current
            if (!titlebar || !main) return

            const titlebar_height = titlebar.getBoundingClientRect().height
            const main_rect = main.getBoundingClientRect()
            const main_style = getComputedStyle(main)
            const main_padding_bottom = Number.parseFloat(main_style.paddingBottom) || 0
            const child_bottom = Array.from(main.children).reduce((bottom, child) => {
                if (!(child instanceof HTMLElement)) return bottom
                return Math.max(bottom, child.getBoundingClientRect().bottom - main_rect.top)
            }, 0)
            const main_height = Math.max(main.scrollHeight, child_bottom + main_padding_bottom)
            const content_height = Math.ceil(titlebar_height + main_height)
            if (content_height > 0) window.electronAPI.window.setContentHeight(content_height).catch(() => undefined)
        }

        resize_to_content()
        const animation_frame = window.requestAnimationFrame(resize_to_content)
        const timeout = window.setTimeout(resize_to_content, 50)
        const observer = new ResizeObserver(resize_to_content)
        if (titlebar_ref.current) observer.observe(titlebar_ref.current)
        if (main_ref.current) {
            observer.observe(main_ref.current)
            Array.from(main_ref.current.children).forEach((child) => { observer.observe(child) })
        }
        document.fonts.ready.then(resize_to_content).catch(() => undefined)

        return () => {
            window.cancelAnimationFrame(animation_frame)
            window.clearTimeout(timeout)
            observer.disconnect()
        }
    }, [])

    const finish_welcome = useCallback(async (): Promise<void> => {
        await window.electronAPI.config.set('welcome_dismissed', true)
    }, [])

    useEffect(() => {
        window.electronAPI.ready('welcome')
    }, [])

    useEffect(() => {
        const handle_key_down = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') window.electronAPI.window.close().catch(() => undefined)
        }
        window.addEventListener('keydown', handle_key_down)
        return () => { window.removeEventListener('keydown', handle_key_down); }
    }, [])

    const close_welcome = useCallback(async (): Promise<void> => {
        await window.electronAPI.window.close()
    }, [])

    const run_action = useCallback(async (action: WelcomeAction): Promise<void> => {
        await finish_welcome()
        if (action === 'translate') {
            await window.electronAPI.tray.action('input_translate')
        } else if (action === 'dictionary') {
            await window.electronAPI.tray.action('dictionary')
        } else if (action === 'ocr_recognize') {
            await window.electronAPI.ocr.captureScreenshot('recognize')
        } else {
            await window.electronAPI.ocr.captureScreenshot('translate')
        }
        await close_welcome()
    }, [close_welcome, finish_welcome])

    const handle_action = useCallback((action: WelcomeAction): void => {
        run_action(action).catch((err: unknown) => {
            log.error('welcome action failed: %s', err instanceof Error ? err.message : String(err))
        })
    }, [run_action])

    const handle_open_hotkey = useCallback((): void => {
        ;(async () => {
            await finish_welcome()
            await window.electronAPI.window.openConfig('hotkey')
            await close_welcome()
        })().catch((err: unknown) => {
            log.error('open hotkey settings failed: %s', err instanceof Error ? err.message : String(err))
        })
    }, [close_welcome, finish_welcome])

    const handle_skip = useCallback((): void => {
        ;(async () => {
            await finish_welcome()
            await close_welcome()
        })().catch((err: unknown) => {
            log.error('skip welcome failed: %s', err instanceof Error ? err.message : String(err))
        })
    }, [close_welcome, finish_welcome])

    return (
        <div className="op-window" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            <div className="op-titlebar" data-testid="titlebar" ref={titlebar_ref}>
                <div className="op-wordmark" data-testid="titlebar-wordmark">{t('app_name', { defaultValue: 'Omni Pot' })}</div>
                <span className="op-mode" data-testid="titlebar-mode">{t('welcome.window_title', { defaultValue: '欢迎' })}</span>
                <div style={{ flex: 1 }} />
                <button className="op-close" title={t('close')} data-testid="titlebar-close" onClick={() => { close_welcome().catch(() => undefined); }}>
                    <Icons.Close size={20} />
                </button>
            </div>
            <main ref={main_ref} data-testid="welcome-empty" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px 16px' }}>
                <div style={{ padding: '6px 4px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="svc-tile" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--brand-primary)', color: '#fff', borderColor: 'transparent', fontSize: 12 }}>op</div>
                    <div className="stack">
                        <div style={{ fontSize: 14, fontWeight: 600 }} data-testid="welcome-title">{t('welcome.title', { defaultValue: '欢迎使用 Omni Pot' })}</div>
                        <div className="hint">{t('welcome.subtitle', { defaultValue: '下面的快捷键已为你预设，随时可在「设置」中修改' })}</div>
                    </div>
                </div>
                {items.map((it) => <HintRow key={it.test_id} item={it} onAction={handle_action} />)}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button className="btn sm" data-testid="welcome-configure-hotkeys" onClick={handle_open_hotkey}>
                        <Icons.Settings size={13} />
                        {t('welcome.configure_hotkeys', { defaultValue: '设置快捷键' })}
                    </button>
                    <button className="btn sm" data-testid="welcome-skip" style={{ color: 'var(--brand-primary)' }} onClick={handle_skip}>
                        {t('welcome.skip', { defaultValue: '跳过' })}
                    </button>
                </div>
            </main>
        </div>
    )
}
