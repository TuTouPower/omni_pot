import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { Titlebar } from '../../components/titlebar'
import { SvcTile, svcLabel } from '../../components/svc_tile'
import { DndContext, closestCenter, PointerSensor, type DragEndEvent, type SensorDescriptor, type SensorOptions } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDictStore } from '../../stores/dict_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { detectLanguage } from '../../services/detect'
import { native_language_name } from '../../i18n/language_names'
import { getServiceKey } from '@shared/types/service'
import { create_logger } from '../../utils/logger'
import type { DictResult, ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import type { LanguageCode } from '@shared/types/language'

const log = create_logger('dict')

function log_error(action: string, err: unknown): void {
    log.error('%s failed: %s', action, err instanceof Error ? err.message : String(err))
}

function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

function dict_result_to_text(result: DictResult): string {
    return result.definitions
        .map((d) => `${d.partOfSpeech} ${d.meanings.join('; ')}`)
        .join('\n')
}

export function SortableDictCard({ instanceKey, result, isLoading, collapsed, onToggleCollapse, hidePosTag }: {
    instanceKey: string; result: DictResult | null | undefined; isLoading: boolean
    collapsed?: boolean; onToggleCollapse?: () => void
    hidePosTag?: boolean
}): React.ReactElement | null {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)
    const serviceKey = getServiceKey(instanceKey)
    const service = translateServiceRegistry.get(serviceKey)
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: instanceKey })
    const copy_timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (copy_timer_ref.current) {
                clearTimeout(copy_timer_ref.current)
            }
        }
    }, [])

    if (!service) return null

    const handleCopy = () => {
        if (!result) return
        const text = dict_result_to_text(result)
        window.electronAPI.text.writeClipboard(text).catch(() => undefined)
        setCopied(true)
        copy_timer_ref.current = setTimeout(() => { setCopied(false); }, 1500)
    }

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div ref={setNodeRef} style={style}>
            <div className="card" data-testid="dict-card" data-result-key={instanceKey} style={{ padding: '10px 12px', overflow: 'visible' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span data-testid="dict-drag" {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--text-mute)' }}>
                        <Icons.Drag size={14} />
                    </span>
                    <SvcTile name={serviceKey} />
                    <div data-testid="dict-source-tag" style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{svcLabel(serviceKey)}</div>
                    {isLoading && (
                        <span className="dots" data-testid="dict-loading" aria-label={t('dict.querying', { defaultValue: '查询中…' })} title={t('dict.querying', { defaultValue: '查询中…' })}>
                            <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>{t('dict.querying', { defaultValue: '查询中…' })}</span>
                            <span /><span /><span />
                        </span>
                    )}
                    <div style={{ flex: 1 }} />
                    {result === null && (
                        <span style={{ color: 'var(--danger)', fontSize: 12 }}>{t('dict.lookup_failed')}</span>
                    )}
                    <button data-testid="dict-copy-btn" className="ic-btn" title={copied ? t('dict.copied', { defaultValue: '已复制' }) : t('result.copy', { defaultValue: '复制' })} disabled={!result} onClick={handleCopy}>
                        <Icons.Copy size={16} />
                    </button>
                    <button className="ic-btn" data-testid="dict-collapse-btn" title={collapsed ? t('result.expand', { defaultValue: '展开' }) : t('result.collapse', { defaultValue: '收起' })} aria-expanded={!collapsed} onClick={onToggleCollapse}>
                        <Icons.Chev size={17} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
                    </button>
                </div>

                {/* Body */}
                {!collapsed && result && (
                    <div style={{ marginTop: 8, marginLeft: 22 }}>
                        {/* Pronunciations with per-item TTS */}
                        {result.pronunciations.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
                                {result.pronunciations.map((p, i) => (
                                    <span key={i} data-testid="dict-pronunciation" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        {p.region && <span className="hint" style={{ fontSize: 11 }}>{p.region}</span>}
                                        <span className="mono" style={{ color: 'var(--text-mute)', fontSize: 12.5 }}>{p.phonetic}</span>
                                        {p.audioUrl && (
                                            <button
                                                className="ic-btn"
                                                data-testid="dict-pron-audio-btn"
                                                title={t('result.tts', { defaultValue: '朗读' })}
                                                onClick={() => { const a = new Audio(p.audioUrl); a.play().catch(() => undefined); }}
                                                style={{ padding: 2 }}
                                            >
                                                <Icons.Volume size={12} />
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Definitions */}
                        {result.definitions.length > 0 && (
                            <div>
                                {!hidePosTag ? (
                                    (() => {
                                        const groups = new Map<string, typeof result.definitions>()
                                        for (const def of result.definitions) {
                                            const key = def.partOfSpeech || ''
                                            let defs = groups.get(key)
                                            if (!defs) {
                                                defs = []
                                                groups.set(key, defs)
                                            }
                                            defs.push(def)
                                        }
                                        return [...groups.entries()].map(([pos, defs], gi) => (
                                            <div key={gi} style={{ marginBottom: gi < groups.size - 1 ? 10 : 0 }}>
                                                {pos && <div data-testid="dict-pos-tag" className="chip plain mono" style={{ fontSize: 10, marginBottom: 4 }}>{pos}</div>}
                                                <div className="stack" style={{ gap: 10 }}>
                                                    {defs.map((def, i) => (
                                                        <div key={i} data-testid="dict-definition" style={{ display: 'flex', gap: 10 }}>
                                                            <div style={{ width: 22, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 11, paddingTop: 3 }}>
                                                                {String(i + 1).padStart(2, '0')}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <span style={{ fontSize: 14, fontWeight: 500 }} data-testid="dict-meaning-primary">{def.meanings[0] ?? ''}</span>
                                                                {def.meanings.slice(1).map((m, mi) => (
                                                                    <div key={mi} data-testid="dict-meaning-alt" style={{ marginTop: 2, fontSize: 12.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>{m}</div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    })()
                                ) : (
                                    <div className="stack" style={{ gap: 10 }}>
                                        {result.definitions.map((def, i) => (
                                            <div key={i} data-testid="dict-definition" style={{ display: 'flex', gap: 10 }}>
                                                <div style={{ width: 22, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 11, paddingTop: 3 }}>
                                                    {String(i + 1).padStart(2, '0')}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 500 }} data-testid="dict-meaning-primary">{def.meanings[0] ?? ''}</span>
                                                    {def.meanings.slice(1).map((m, mi) => (
                                                        <div key={mi} data-testid="dict-meaning-alt" style={{ marginTop: 2, fontSize: 12.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>{m}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Examples */}
                        {result.examples.length > 0 && (
                            <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                                <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                                    {t('dict.examples', { defaultValue: '例句' })}
                                </div>
                                <div className="stack" style={{ gap: 8 }}>
                                    {result.examples.map((ex, i) => (
                                        <div key={i} data-testid="dict-example" style={{ borderLeft: '2px solid var(--line-strong)', paddingLeft: 10 }}>
                                            <div style={{ fontSize: 13, lineHeight: 1.55 }}>{ex.source}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Loading shimmer */}
                {!collapsed && isLoading && result === undefined && (
                    <div data-testid="dict-shimmer" style={{ marginTop: 8, marginLeft: 22, display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                        <div className="shimmer" style={{ height: 13, width: '70%' }} />
                        <div className="shimmer" style={{ height: 13, width: '90%' }} />
                        <div className="shimmer" style={{ height: 13, width: '50%' }} />
                    </div>
                )}
            </div>
        </div>
    )
}

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
        const content = content_ref.current

        let frame_id = 0
        const report = (): void => {
            window.cancelAnimationFrame(frame_id)
            frame_id = window.requestAnimationFrame(() => {
                const titlebar_h = titlebar ? titlebar.getBoundingClientRect().height : 0
                const content_h = content ? content.scrollHeight : 0
                const total = Math.ceil(titlebar_h + content_h)
                if (total === last_reported_content_height_ref.current) return
                last_reported_content_height_ref.current = total
                window.electronAPI.dict.reportContentHeight(total).catch(() => undefined)
            })
        }

        report()
        const observer = new ResizeObserver(report)
        if (titlebar) observer.observe(titlebar)
        if (content) observer.observe(content)
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

            <div ref={content_ref} style={{ flex: 1, overflow: 'auto', padding: '4px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                                    />
                                )
                            })}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    )
}
