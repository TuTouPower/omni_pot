import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { SvcTile, svcLabel } from '../../components/svc_tile'
import { DndContext, closestCenter, PointerSensor, type DragEndEvent, type SensorDescriptor, type SensorOptions } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDictStore } from '../../stores/dict_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { collectionServiceRegistry } from '../../services/index'
import { detectLanguage } from '../../services/detect'
import { native_language_name } from '../../i18n/language_names'
import { getServiceKey } from '@shared/types/service'
import type { DictResult, ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import type { LanguageCode } from '@shared/types/language'

function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

function dict_result_to_text(result: DictResult): string {
    return result.definitions
        .map((d) => `${d.partOfSpeech} ${d.meanings.join('; ')}`)
        .join('\n')
}

function SortableDictCard({ instanceKey, result, isLoading, isCollected, onCollect, collectionAvailable, collapsed, onToggleCollapse, onTts, ttsPlayingKey, ttsAvailable }: {
    instanceKey: string; result: DictResult | null | undefined; isLoading: boolean
    isCollected?: boolean; onCollect?: () => void; collectionAvailable?: boolean
    collapsed?: boolean; onToggleCollapse?: () => void
    onTts?: (text: string) => void; ttsPlayingKey?: string | null; ttsAvailable?: boolean
}): React.ReactElement | null {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)
    const serviceKey = getServiceKey(instanceKey)
    const service = translateServiceRegistry.get(serviceKey)
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: instanceKey })

    if (!service) return null

    const is_playing = ttsPlayingKey === instanceKey

    const handleCopy = () => {
        if (!result) return
        const text = dict_result_to_text(result)
        window.electronAPI.text.writeClipboard(text).catch(() => undefined)
        setCopied(true)
        setTimeout(() => { setCopied(false); }, 1500)
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
                        <span className="dots" data-testid="dict-loading" aria-label="查询中" title="查询中…">
                            <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>查询中…</span>
                            <span /><span /><span />
                        </span>
                    )}
                    <div style={{ flex: 1 }} />
                    {result === null && (
                        <span style={{ color: 'var(--danger)', fontSize: 12 }}>{t('dict.lookup_failed')}</span>
                    )}
                    <button
                        data-testid="dict-tts-btn"
                        className={'ic-btn' + (is_playing ? ' brand' : '')}
                        title={is_playing ? t('tts_stop', { defaultValue: '停止朗读' }) : t('result.tts', { defaultValue: '朗读' })}
                        aria-pressed={is_playing}
                        disabled={!ttsAvailable || !result}
                        style={is_playing ? { background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)' } : undefined}
                        onClick={() => { if (result && onTts) onTts(dict_result_to_text(result)); }}
                    >
                        <Icons.Volume size={16} fill={is_playing} />
                    </button>
                    <button data-testid="dict-copy-btn" className="ic-btn" title={copied ? t('dict.copied', { defaultValue: '已复制' }) : t('result.copy', { defaultValue: '复制' })} disabled={!result} onClick={handleCopy}>
                        <Icons.Copy size={16} />
                    </button>
                    {onCollect && (
                        <button
                            className="ic-btn"
                            data-testid="dict-collect-btn"
                            title={t('result.collect', { defaultValue: '收藏' })}
                            aria-pressed={isCollected}
                            disabled={!collectionAvailable || !result}
                            onClick={onCollect}
                            style={{ color: isCollected ? 'var(--brand-primary)' : undefined }}
                        >
                            <Icons.Heart size={16} fill={isCollected} />
                        </button>
                    )}
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
                                        {ttsAvailable && onTts && (
                                            <button
                                                className="ic-btn"
                                                data-testid="dict-pron-tts-btn"
                                                title={t('result.tts', { defaultValue: '朗读' })}
                                                onClick={() => { onTts(p.phonetic); }}
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                    {result.definitions.map((def, i) => (
                                        <span key={i} data-testid="dict-pos-tag" className="chip plain mono" style={{ fontSize: 10 }}>{def.partOfSpeech}</span>
                                    ))}
                                </div>
                                <div className="stack" style={{ gap: 10 }}>
                                    {result.definitions.map((def, i) => (
                                        <div key={i} data-testid="dict-definition" style={{ display: 'flex', gap: 10 }}>
                                            <div style={{ width: 22, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 11, paddingTop: 3 }}>
                                                {String(i + 1).padStart(2, '0')}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span className="chip plain mono" style={{ fontSize: 10 }}>{def.partOfSpeech}</span>
                                                    <span style={{ fontSize: 14, fontWeight: 500 }} data-testid="dict-meaning-primary">{def.meanings[0] ?? ''}</span>
                                                </div>
                                                {def.meanings.slice(1).map((m, mi) => (
                                                    <div key={mi} data-testid="dict-meaning-alt" style={{ marginTop: 2, fontSize: 12.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>{m}</div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
    const collectionServiceList = useConfigStore((s) => s.config.collection_service_list)
    const serviceInstances = useConfigStore((s) => s.config.service_instances)
    const allDictionaryInstances = useMemo(() => [...new Set([...zhServiceList, ...enServiceList])], [zhServiceList, enServiceList])
    const enabledServiceList = useMemo(
        () => allDictionaryInstances.filter((instanceKey) => get_service_config(serviceInstances, instanceKey).enable !== false),
        [allDictionaryInstances, serviceInstances]
    )
    const enabledCollectionServiceList = useMemo(
        () => collectionServiceList.filter((instanceKey) => get_service_config(serviceInstances, instanceKey).enable !== false),
        [collectionServiceList, serviceInstances]
    )
    const alwaysOnTop = useConfigStore((s) => s.config.dict_always_on_top)
    const setConfig = useConfigStore((s) => s.set)

    const [dictReady, setDictReady] = useState<boolean | null>(null)
    const [selection_notice, setSelectionNotice] = useState(false)
    const [importing, setImporting] = useState(false)
    const [collectedKeys, setCollectedKeys] = useState<Set<string>>(new Set())
    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())
    const [ttsPlayingKey, setTtsPlayingKey] = useState<string | null>(null)
    const ttsCleanupRef = useRef<(() => void) | null>(null)
    const ttsRequestRef = useRef(0)
    const lookup_request_ref = useRef(0)
    const inputRef = useRef<HTMLDivElement>(null)
    const sourceLangRef = useRef<LanguageCode>('en')

    useEffect(() => {
        window.electronAPI.dict.check().then(({ ready }) => { setDictReady(ready); }).catch(console.error)
    }, [])

    const handleImport = useCallback(async () => {
        setImporting(true)
        const result = await window.electronAPI.dict.import()
        if (result.success) {
            setDictReady(true)
        }
        setImporting(false)
    }, [])

    const handleLookup = useCallback(async (text: string) => {
        const trimmed = text.trim()
        if (!trimmed) return

        setSelectionNotice(false)
        const request_id = lookup_request_ref.current + 1
        lookup_request_ref.current = request_id
        setWord(trimmed)
        setCollectedKeys(new Set())
        setCollapsedKeys(new Set())
        setIsLoading(true)
        clearResults()

        const lookupWord = trimmed.split(' ')[0] ?? ''
        const detectEngine = useConfigStore.getState().config.translate_detect_engine
        const detected = await detectLanguage(lookupWord, detectEngine)
        if (lookup_request_ref.current !== request_id) return
        setDetectedLanguage(detected)
        sourceLangRef.current = detected

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
                } else {
                    setResult(instanceKey, null)
                }
            } catch {
                if (lookup_request_ref.current === request_id) {
                    setResult(instanceKey, null)
                }
            }
        })

        await Promise.allSettled(promises)
        if (lookup_request_ref.current === request_id) {
            setIsLoading(false)
        }
    }, [zhServiceList, enServiceList, serviceInstances, setWord, setDetectedLanguage, setIsLoading, clearResults, setResult])

    useEffect(() => {
        const unsub = window.electronAPI.text.onDictLookup((text: string) => {
            if (!text.trim()) return
            handleLookup(text).catch(console.error)
        })
        return unsub
    }, [handleLookup])

    useEffect(() => {
        const unsub = window.electronAPI.text.onDictSelectionEmpty(() => {
            lookup_request_ref.current += 1
            setSelectionNotice(true)
            setWord('')
            setIsLoading(false)
            clearResults()
        })
        return unsub
    }, [setWord, setIsLoading, clearResults])

    useEffect(() => {
        window.electronAPI.ready('dict')
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') window.electronAPI.window.close().catch(console.error)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => { window.removeEventListener('keydown', handleKeyDown); }
    }, [])

    const handleClose = useCallback(() => { window.electronAPI.window.close().catch(console.error) }, [])
    const handleTogglePin = useCallback(() => {
        const next = !alwaysOnTop
        window.electronAPI.window.setAlwaysOnTop(next)
            .then(() => { setConfig('dict_always_on_top', next) })
            .catch(console.error)
    }, [alwaysOnTop, setConfig])

    const collection_available = enabledCollectionServiceList.length > 0
    const ttsServiceList = useConfigStore((s) => s.config.tts_service_list ?? [])
    const ttsAvailable = ttsServiceList.length > 0

    const handleCollect = useCallback(async (instanceKey: string) => {
        const result = results[instanceKey]
        const trimmed_word = word.trim()
        if (!trimmed_word || !result || enabledCollectionServiceList.length === 0) return

        const result_text = dict_result_to_text(result)
        let collected_result = false
        for (const collInstanceKey of enabledCollectionServiceList) {
            const collKey = getServiceKey(collInstanceKey)
            const service = collectionServiceRegistry.get(collKey)
            if (!service) continue
            const instance_config = get_service_config(serviceInstances, collInstanceKey)
            try {
                await service.send(trimmed_word, 'auto', 'zh_cn', result_text, instance_config)
                collected_result = true
            } catch { /* skip failed services */ }
        }

        if (collected_result) {
            setCollectedKeys((prev) => new Set(prev).add(instanceKey))
        }
    }, [word, results, enabledCollectionServiceList, serviceInstances])

    const toggleCollapse = useCallback((key: string) => {
        setCollapsedKeys((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const stopTts = useCallback(() => {
        ttsRequestRef.current += 1
        ttsCleanupRef.current?.()
        ttsCleanupRef.current = null
        setTtsPlayingKey(null)
    }, [])

    const handleTts = useCallback((text: string) => {
        if (!text.trim() || ttsServiceList.length === 0) return

        const instanceKey = ttsServiceList[0]
        if (!instanceKey) return
        const svcKey = getServiceKey(instanceKey)
        const ttsService = ttsServiceRegistry.get(svcKey)
        if (!ttsService) return

        const request_id = ttsRequestRef.current + 1
        ttsRequestRef.current = request_id
        setTtsPlayingKey('pron')
        const instanceConfig = get_service_config(serviceInstances, instanceKey)
        try {
            const handle = ttsService.play(text.trim(), sourceLangRef.current, instanceConfig)
            const reset = (): void => {
                if (ttsRequestRef.current === request_id) {
                    setTtsPlayingKey(null)
                }
                if (ttsCleanupRef.current === reset) {
                    ttsCleanupRef.current = null
                }
            }
            ttsCleanupRef.current = () => { handle.stop(); reset() }
            handle.done.then(reset, reset)
        } catch {
            if (ttsRequestRef.current === request_id) {
                setTtsPlayingKey(null)
            }
        }
    }, [ttsServiceList, serviceInstances])

    useEffect(() => {
        return () => {
            ttsRequestRef.current += 1
            ttsCleanupRef.current?.()
            ttsCleanupRef.current = null
        }
    }, [])

    const [wordCopied, setWordCopied] = useState(false)
    const handleCopyWord = useCallback(() => {
        if (!word.trim()) return
        window.electronAPI.text.writeClipboard(word.trim()).catch(() => undefined)
        setWordCopied(true)
        setTimeout(() => { setWordCopied(false); }, 1500)
    }, [word])

    const handleCollectFirst = useCallback(() => {
        const firstKey = enabledServiceList.find((ik) => results[ik])
        if (firstKey) handleCollect(firstKey).catch(console.error)
    }, [enabledServiceList, results, handleCollect])

    const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            const text = inputRef.current?.textContent?.trim() ?? ''
            if (text) handleLookup(text).catch(console.error)
        }
    }, [handleLookup])

    const handleLookupClick = useCallback(() => {
        const text = inputRef.current?.textContent?.trim() ?? word.trim()
        if (text) handleLookup(text).catch(console.error)
    }, [word, handleLookup])

    const sensors = useMemo<SensorDescriptor<SensorOptions>[]>(() => [{
        sensor: PointerSensor,
        options: { activationConstraint: { distance: 5 } },
    }], [])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIdx = enabledServiceList.indexOf(String(active.id))
        const newIdx = enabledServiceList.indexOf(String(over.id))
        if (oldIdx === -1 || newIdx === -1) return

        const enabledSet = new Set(enabledServiceList)
        const enabledList = [...enabledServiceList]
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
    }, [enabledServiceList, zhServiceList, enServiceList])

    return (
        <div className="op-window">
            {/* Titlebar */}
            <div className="op-titlebar">
                <button
                    className="ic-btn"
                    title="置顶"
                    data-testid="titlebar-pin"
                    onClick={handleTogglePin}
                    style={{ color: alwaysOnTop ? 'var(--brand-primary)' : 'var(--text-mute)' }}
                >
                    <Icons.Pin size={14} fill={alwaysOnTop} />
                </button>
                <div className="op-wordmark" style={{ marginLeft: 2 }} data-testid="titlebar-wordmark">
                    Omni Pot
                </div>
                <span className="op-mode" data-testid="titlebar-mode">词典</span>
                <div style={{ flex: 1 }} />
                <button className="ic-btn" title="关闭" data-testid="titlebar-close" onClick={handleClose}>
                    <Icons.Close size={14} />
                </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '4px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Source word card */}
                <div className="card" data-testid="dict-card" style={{ padding: 0, overflow: 'visible' }}>
                    <div style={{ padding: '12px 14px 4px' }}>
                        <div
                            ref={inputRef}
                            contentEditable
                            suppressContentEditableWarning
                            data-testid="dict-word"
                            onKeyDown={handleInputKeyDown}
                            style={{
                                fontSize: 18,
                                fontWeight: 600,
                                letterSpacing: '-0.005em',
                                lineHeight: 1.35,
                                outline: 'none',
                                wordBreak: 'break-word',
                                color: 'var(--text)',
                                minHeight: 24,
                            }}
                        >
                            {word}
                        </div>
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
                            data-testid="dict-source-collect-btn"
                            title={t('result.collect', { defaultValue: '收藏' })}
                            onClick={handleCollectFirst}
                            disabled={!collection_available || !enabledServiceList.find((ik) => results[ik])}
                        >
                            <Icons.Heart size={16} />
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

                {/* Empty selection feedback */}
                {selection_notice && (
                    <div className="card" data-testid="selection-empty-notice" style={{ padding: '12px 14px', color: 'var(--text-dim)', fontSize: 13 }}>
                        {t('selection.no_text')}
                    </div>
                )}

                {/* Dictionary not ready */}
                {dictReady === false && (
                    <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>CC-CEDICT dictionary not downloaded</p>
                        <button className="btn primary" onClick={() => { handleImport().catch(console.error); }} disabled={importing}>
                            {importing ? 'Downloading...' : 'Download Dictionary (~6MB)'}
                        </button>
                    </div>
                )}

                {/* Results with DnD */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={enabledServiceList} strategy={verticalListSortingStrategy}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {enabledServiceList.map((instanceKey) => {
                                const hasResult = Object.prototype.hasOwnProperty.call(results, instanceKey)
                                return (
                                    <SortableDictCard
                                        key={instanceKey}
                                        instanceKey={instanceKey}
                                        result={hasResult ? (results[instanceKey] ?? null) : undefined}
                                        isLoading={isLoading && !hasResult}
                                        isCollected={collectedKeys.has(instanceKey)}
                                        onCollect={() => { handleCollect(instanceKey).catch(console.error); }}
                                        collectionAvailable={collection_available}
                                        collapsed={collapsedKeys.has(instanceKey)}
                                        onToggleCollapse={() => { toggleCollapse(instanceKey); }}
                                        onTts={handleTts}
                                        ttsPlayingKey={ttsPlayingKey}
                                        ttsAvailable={ttsAvailable}
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
