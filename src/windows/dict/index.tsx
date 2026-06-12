import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { Titlebar } from '../../components/titlebar'
import { DndContext, closestCenter, PointerSensor, type DragEndEvent, type SensorDescriptor, type SensorOptions } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDictStore } from '../../stores/dict_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { detectLanguage } from '../../services/detect'
import { native_language_name } from '../../i18n/language_names'
import { getServiceKey } from '@shared/types/service'
import { create_logger } from '../../utils/logger'
import { log_error, get_service_config } from './dict_helpers'
import { SortableDictCard } from './dict_card'
import type { LanguageCode } from '@shared/types/language'

const log = create_logger('dict')

export default function DictWindow(): React.ReactElement {
    const { t } = useTranslation()
    const word = useDictStore((s) => s.word)
    const detectedLanguage = useDictStore((s) => s.detectedLanguage)
    const results = useDictStore((s) => s.results)
    const isLoading = useDictStore((s) => s.isLoading)
    const setWord = useDictStore((s) => s.setWord)
    const setDetectedLanguage = useDictStore((s) => s.setDetectedLanguage)
    const setResult = useDictStore((s) => s.setResult)
    const setIsLoading = useDictStore((s) => s.setIsLoading)
    const clearResults = useDictStore((s) => s.clearResults)

    const zhServiceList = useConfigStore((s) => s.config.dictionary_service_list)
    const enServiceList = useConfigStore((s) => s.config.english_dictionary_service_list)
    const serviceInstances = useConfigStore((s) => s.config.service_instances)
    const allDictionaryInstances = useMemo(() => [...new Set([...zhServiceList, ...enServiceList])], [zhServiceList, enServiceList])
    const enabledServiceList = useMemo(
        () => allDictionaryInstances.filter((instanceKey) => get_service_config(serviceInstances, instanceKey).enable !== false),
        [allDictionaryInstances, serviceInstances]
    )
    const activeList = useMemo(() => {
        if (!detectedLanguage) return enabledServiceList
        const isEn = detectedLanguage === 'en'
        const langList = isEn ? enServiceList : zhServiceList
        return langList.filter((instanceKey) => get_service_config(serviceInstances, instanceKey).enable !== false)
    }, [detectedLanguage, enabledServiceList, enServiceList, zhServiceList, serviceInstances])
    const alwaysOnTop = useConfigStore((s) => s.config.dict_always_on_top)
    const configPinned = useConfigStore((s) => s.config.dict_pinned)
    const pinned = configPinned || alwaysOnTop
    const setConfig = useConfigStore((s) => s.set)

    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set())
    const lookup_request_ref = useRef(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const root_ref = useRef<HTMLDivElement>(null)
    const titlebar_ref = useRef<HTMLDivElement>(null)
    const content_ref = useRef<HTMLDivElement>(null)
    const inner_content_ref = useRef<HTMLDivElement>(null)
    const last_reported_content_height_ref = useRef(0)
    const appFont = useConfigStore((s) => s.config.app_font)
    const appFontSize = useConfigStore((s) => s.config.app_font_size)

    useEffect(() => {
        setCollapsedKeys((prev) => {
            const next = new Set(prev)
            let changed = false
            for (const key of enabledServiceList) {
                if (!Object.prototype.hasOwnProperty.call(results, key) && !next.has(key)) {
                    next.add(key)
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [enabledServiceList, results])

    const handleLookup = useCallback(async (text: string) => {
        const trimmed = text.trim()
        if (!trimmed) return

        const request_id = lookup_request_ref.current + 1
        lookup_request_ref.current = request_id
        setWord(trimmed)
        setCollapsedKeys(new Set(enabledServiceList))
        setIsLoading(true)
        clearResults()

        const lookupWord = trimmed.split(' ')[0] ?? ''
        const detected = await detectLanguage(lookupWord)
        if (lookup_request_ref.current !== request_id) return
        log.info('lookup: len=%d, detected=%s', lookupWord.length, detected)
        setDetectedLanguage(detected)

        const isEn = detected === 'en'
        const source_language = detected
        const target_language: LanguageCode = isEn ? 'zh_cn' : 'en'
        const activeList = isEn ? enServiceList : zhServiceList

        const promises = activeList.map(async (instanceKey) => {
            if (get_service_config(serviceInstances, instanceKey).enable === false) return
            const serviceKey = getServiceKey(instanceKey)
            const service = translateServiceRegistry.get(serviceKey)
            if (!service) {
                if (lookup_request_ref.current === request_id) {
                    setResult(instanceKey, null)
                }
                return
            }
            const instanceConfig = get_service_config(serviceInstances, instanceKey)
            try {
                const result = await service.translate(lookupWord, source_language, target_language, instanceConfig)
                if (lookup_request_ref.current !== request_id) return
                if (typeof result === 'object') {
                    setResult(instanceKey, result)
                    setCollapsedKeys((prev) => {
                        if (!prev.has(instanceKey)) return prev
                        const next = new Set(prev)
                        next.delete(instanceKey)
                        return next
                    })
                } else {
                    setResult(instanceKey, null)
                }
            } catch (err) {
                log.error('dict service %s failed: %s', instanceKey, err instanceof Error ? err.message : String(err))
                if (lookup_request_ref.current === request_id) {
                    setResult(instanceKey, null)
                }
            }
        })

        await Promise.allSettled(promises)
        if (lookup_request_ref.current === request_id) {
            setIsLoading(false)
        }
    }, [zhServiceList, enServiceList, serviceInstances, enabledServiceList, setWord, setDetectedLanguage, setIsLoading, clearResults, setResult])

    const focusWordInput = useCallback(() => {
        window.requestAnimationFrame(() => { inputRef.current?.focus() })
    }, [])

    useEffect(() => {
        const unsub = window.electronAPI.text.onDictLookup((text: string) => {
            if (!text.trim()) return
            handleLookup(text).catch((err: unknown) => { log_error('dict lookup', err) })
        })
        return unsub
    }, [handleLookup])

    useEffect(() => {
        const unsub = window.electronAPI.text.onDictSelectionEmpty(() => {
            lookup_request_ref.current += 1
            setWord('')
            setDetectedLanguage(null)
            setIsLoading(false)
            clearResults()
            focusWordInput()
        })
        return unsub
    }, [setWord, setDetectedLanguage, setIsLoading, clearResults, focusWordInput])

    useEffect(() => {
        window.electronAPI.ready('dict')
    }, [])

    useEffect(() => {
        const titlebar = titlebar_ref.current
        const content_outer = content_ref.current
        const inner = inner_content_ref.current

        let frame_id = 0
        const report = (): void => {
            window.cancelAnimationFrame(frame_id)
            frame_id = window.requestAnimationFrame(() => {
                const titlebar_h = titlebar ? titlebar.getBoundingClientRect().height : 0
                const inner_h = inner ? inner.getBoundingClientRect().height : 0
                const outer_style = content_outer ? getComputedStyle(content_outer) : null
                const padding_h = outer_style
                    ? Number.parseFloat(outer_style.paddingTop) + Number.parseFloat(outer_style.paddingBottom)
                    : 0
                const total = Math.ceil(titlebar_h + inner_h + padding_h)
                if (total === last_reported_content_height_ref.current) return
                last_reported_content_height_ref.current = total
                log.info('[dict-height] report titlebar=%d inner=%d pad=%d total=%d',
                    Math.round(titlebar_h), Math.round(inner_h), Math.round(padding_h), total)
                window.electronAPI.dict.reportContentHeight(total).catch(() => undefined)
            })
        }

        report()
        const observer = new ResizeObserver(report)
        if (titlebar) observer.observe(titlebar)
        if (inner) observer.observe(inner)
        return () => {
            window.cancelAnimationFrame(frame_id)
            observer.disconnect()
        }
    }, [activeList.length, results, collapsedKeys, isLoading, appFont, appFontSize, word, detectedLanguage])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') window.electronAPI.window.close().catch((err: unknown) => { log_error('close window', err) })
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => { window.removeEventListener('keydown', handleKeyDown); }
    }, [])

    const handleClose = useCallback(() => { window.electronAPI.window.close().catch((err: unknown) => { log_error('close window', err) }) }, [])
    const handleTogglePin = useCallback(() => {
        setConfig('dict_pinned', !configPinned)
    }, [configPinned, setConfig])
    const handleToggleAlwaysOnTop = useCallback(() => {
        const next = !alwaysOnTop
        window.electronAPI.window.setAlwaysOnTop(next)
            .then(() => { setConfig('dict_always_on_top', next) })
            .catch((err: unknown) => { log_error('set always on top', err) })
    }, [alwaysOnTop, setConfig])

    const toggleCollapse = useCallback((key: string) => {
        setCollapsedKeys((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const [wordCopied, setWordCopied] = useState(false)
    const handleCopyWord = useCallback(() => {
        if (!word.trim()) return
        window.electronAPI.text.writeClipboard(word.trim()).catch(() => undefined)
        setWordCopied(true)
        setTimeout(() => { setWordCopied(false); }, 1500)
    }, [word])

    const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            const text = word.trim()
            if (text) handleLookup(text).catch((err: unknown) => { log_error('dict lookup', err) })
        }
    }, [word, handleLookup])

    const handleLookupClick = useCallback(() => {
        const text = word.trim()
        if (text) handleLookup(text).catch((err: unknown) => { log_error('dict lookup', err) })
    }, [word, handleLookup])

    const sensors = useMemo<SensorDescriptor<SensorOptions>[]>(() => [{
        sensor: PointerSensor,
        options: { activationConstraint: { distance: 5 } },
    }], [])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIdx = activeList.indexOf(String(active.id))
        const newIdx = activeList.indexOf(String(over.id))
        if (oldIdx === -1 || newIdx === -1) return

        const enabledSet = new Set(activeList)
        const enabledList = [...activeList]
        const [moved] = enabledList.splice(oldIdx, 1) as [string]
        enabledList.splice(newIdx, 0, moved)

        let enabledIdx = 0
        const updateList = (list: string[]) => list.map((instanceKey) => {
            if (!enabledSet.has(instanceKey)) return instanceKey
            const [reorderedKey] = enabledList.slice(enabledIdx, enabledIdx + 1) as [string]
            enabledIdx += 1
            return reorderedKey
        })

        useConfigStore.getState().set('dictionary_service_list', updateList(zhServiceList))
        useConfigStore.getState().set('english_dictionary_service_list', updateList(enServiceList))
    }, [activeList, zhServiceList, enServiceList])

    return (
        <div ref={root_ref} className="op-window">
            {/* Titlebar */}
            <Titlebar
                containerRef={titlebar_ref}
                alwaysOnTop={alwaysOnTop}
                pinned={pinned}
                onToggleTopmost={handleToggleAlwaysOnTop}
                onTogglePin={handleTogglePin}
                modeLabel={t('dict.title', { defaultValue: '词典' })}
                onClose={handleClose}
            />

            <div ref={content_ref} style={{ flex: 1, overflow: 'auto', padding: '4px 12px 14px' }}>
                <div ref={inner_content_ref} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Source word card */}
                <div className="card" data-testid="dict-card" style={{ padding: 0, overflow: 'visible' }}>
                    <div style={{ padding: '12px 14px 4px' }}>
                        <input
                            ref={inputRef}
                            data-testid="dict-word"
                            aria-label={t('dict.placeholder', { defaultValue: '输入单词...' })}
                            value={word}
                            onChange={(e) => { setWord(e.target.value) }}
                            onKeyDown={handleInputKeyDown}
                            placeholder={t('dict.placeholder', { defaultValue: '输入单词...' })}
                            style={{
                                width: '100%',
                                fontSize: 18,
                                fontWeight: 600,
                                letterSpacing: '-0.005em',
                                lineHeight: 1.35,
                                outline: 'none',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text)',
                                minHeight: 24,
                                padding: 0,
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px 8px' }}>
                        <span data-testid="dict-detected-lang" style={{ fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', paddingLeft: 4 }}>
                            {detectedLanguage && <>{t('detected_language_prefix', { defaultValue: '检测为' })} <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{native_language_name(t, detectedLanguage)}</span></>}
                        </span>
                        <div style={{ flex: 1 }} />
                        <button
                            className="ic-btn"
                            data-testid="dict-copy-btn"
                            title={wordCopied ? t('dict.copied', { defaultValue: '已复制' }) : t('result.copy', { defaultValue: '复制' })}
                            onClick={handleCopyWord}
                        >
                            <Icons.Copy size={16} />
                        </button>
                        <button
                            className="ic-btn"
                            data-testid="dict-lookup-btn"
                            title={t('dict.look_up', { defaultValue: '查询' })}
                            onClick={handleLookupClick}
                            style={{ color: 'var(--brand-primary)' }}
                        >
                            <Icons.Type size={16} />
                        </button>
                    </div>
                </div>


                {/* Results with DnD */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={activeList} strategy={verticalListSortingStrategy}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {activeList.map((instanceKey) => {
                                const hasResult = Object.prototype.hasOwnProperty.call(results, instanceKey)
                                const is_zh_dict = zhServiceList.includes(instanceKey)
                                return (
                                    <SortableDictCard
                                        key={instanceKey}
                                        instanceKey={instanceKey}
                                        result={hasResult ? (results[instanceKey] ?? null) : undefined}
                                        isLoading={isLoading && !hasResult}
                                        collapsed={collapsedKeys.has(instanceKey)}
                                        onToggleCollapse={() => { toggleCollapse(instanceKey); }}
                                        hidePosTag={is_zh_dict}
                                        hideTts={is_zh_dict}
                                    />
                                )
                            })}
                        </div>
                    </SortableContext>
                </DndContext>
                </div>
            </div>
        </div>
    )
}
