import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { SvcTile, svcLabel } from '../../components/svc_tile'
import { DndContext, closestCenter, PointerSensor, type DragEndEvent, type SensorDescriptor, type SensorOptions } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { getServiceKey } from '@shared/types/service'
import type { DictResult, ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'

function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

interface TargetAreaProps {
    serviceList: string[]
    ttsServiceList: string[]
    hasAnyRequest: boolean
    onRetry?: (instanceKey: string) => void
}

function result_to_text(result: string | DictResult | null | undefined): string {
    if (typeof result === 'string') return result
    if (!result) return ''
    return result.definitions.map((d) => `${d.part_of_speech} ${d.meanings.join('; ')}`).join('\n')
}

interface SortableCardProps {
    instanceKey: string
    results: Record<string, string | DictResult | null | undefined>
    isTranslating: boolean
    collapsed: boolean
    onToggleCollapse: (key: string) => void
    onRetry?: (key: string) => void
    onCopy: (text: string) => void
    onTts: (text: string, key: string) => void
    onReverseTranslate: (text: string) => void
    playingKey: string | null
    busyKey: string | null
    ttsAvailable: boolean
}

function SortableCard({
    instanceKey, results, isTranslating, collapsed, onToggleCollapse, onRetry,
    onCopy, onTts,
    playingKey, busyKey, ttsAvailable,
}: SortableCardProps): React.ReactElement | null {
    const { t } = useTranslation()
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: instanceKey })
    const serviceKey = getServiceKey(instanceKey)
    const service = translateServiceRegistry.get(serviceKey)
    if (!service) return null

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        width: '100%',
    }

    const result = results[instanceKey]
    const result_text = result_to_text(result)
    const is_loading = isTranslating && result === undefined
    const is_playing = playingKey === instanceKey
    const is_busy = busyKey === instanceKey

    return (
        <div ref={setNodeRef} style={style}>
            <div className="card" data-testid="result-card" data-result-key={instanceKey} style={{ padding: '10px 12px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span data-testid="result-drag" {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--text-mute)' }}>
                        <Icons.Drag size={14} />
                    </span>
                    <SvcTile name={serviceKey} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{svcLabel(serviceKey)}</div>
                    {is_loading && (
                        <span className="dots" data-testid="result-loading" aria-label={t('result.translating', { defaultValue: '翻译中…' })} title={t('result.translating', { defaultValue: '翻译中…' })}>
                            <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>{t('result.translating', { defaultValue: '翻译中…' })}</span>
                            <span /><span /><span />
                        </span>
                    )}
                    <div style={{ flex: 1 }} />
                    {result === null && onRetry && (
                        <button data-testid="result-retry" className="ic-btn" title={t('result.retry', { defaultValue: '重试' })} onClick={() => { onRetry(instanceKey); }} style={{ color: 'var(--danger)' }}>
                            <Icons.Cycle size={14} />
                        </button>
                    )}
                    <button
                        data-testid="result-tts"
                        className={'ic-btn' + (is_playing ? ' brand' : '')}
                        title={is_busy ? t('tts_cancel', { defaultValue: '取消朗读' }) : (is_playing ? t('tts_stop', { defaultValue: '停止朗读' }) : t('result.tts', { defaultValue: '朗读' }))}
                        aria-pressed={is_playing || is_busy}
                        disabled={!ttsAvailable || (!result_text && !is_busy && !is_playing)}
                        style={is_playing ? { background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)' } : undefined}
                        onClick={() => {
                            if (result_text || is_busy) onTts(result_text, instanceKey)
                        }}
                    >
                        {is_busy ? (
                            <span className="dots" aria-label="加载中"><span /><span /><span /></span>
                        ) : (
                            <Icons.Volume size={16} fill={is_playing} />
                        )}
                    </button>
                    <button data-testid="result-copy" className="ic-btn" title={t('result.copy', { defaultValue: '复制' })} disabled={!result_text} onClick={() => {
                        if (result_text) onCopy(result_text)
                    }}>
                        <Icons.Copy size={16} />
                    </button>
                    <button data-testid="result-collapse" className="ic-btn" title={collapsed ? t('result.expand', { defaultValue: '展开' }) : t('result.collapse', { defaultValue: '收起' })} aria-expanded={!collapsed} onClick={() => { onToggleCollapse(instanceKey); }}>
                        <Icons.Chev size={17} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
                    </button>
                </div>

                {/* Content */}
                {!collapsed && (
                    result === null ? (
                        <div data-testid="result-error" data-result-error style={{ marginTop: 8, marginLeft: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--danger)', fontSize: 13 }}>{t('result.failed', { defaultValue: '翻译失败' })}</span>
                        </div>
                    ) : result !== undefined ? (
                        <div data-testid="result-body" data-result-content style={{ marginTop: 8, marginLeft: 22, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {typeof result === 'string'
                                ? (result || <span style={{ color: 'var(--text-mute)' }}>…</span>)
                                : <DictResultInline result={result} />
                            }
                        </div>
                    ) : is_loading ? (
                        <div data-testid="result-shimmer" style={{ marginTop: 8, marginLeft: 22, display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                            <div className="shimmer" style={{ height: 13, width: '70%' }} />
                            <div className="shimmer" style={{ height: 13, width: '90%' }} />
                            <div className="shimmer" style={{ height: 13, width: '50%' }} />
                        </div>
                    ) : null
                )}
            </div>
        </div>
    )
}

function DictResultInline({ result }: { result: DictResult }): React.ReactElement {
    return (
        <div>
            {result.pronunciations.length > 0 && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                    {result.pronunciations.map((p, i) => (
                        <span key={i} style={{ fontSize: 12, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)' }}>
                            {p.region && `${p.region} `}{p.phonetic}
                        </span>
                    ))}
                </div>
            )}
            {result.definitions.map((def, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                    <span className="chip plain mono" style={{ fontSize: 10, marginRight: 6 }}>{def.part_of_speech}</span>
                    {def.meanings.join('; ')}
                </div>
            ))}
            {result.examples.length > 0 && (
                <div style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                    {result.examples.map((ex, i) => (
                        <p key={i} style={{ fontSize: 12.5, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 4 }}>{ex.source}</p>
                    ))}
                </div>
            )}
        </div>
    )
}

export function TargetArea({ serviceList, ttsServiceList, hasAnyRequest, onRetry }: TargetAreaProps): React.ReactElement | null {
    const results = useTranslateStore((s) => s.results)
    const isTranslating = useTranslateStore((s) => s.isTranslating)
    const targetLanguage = useTranslateStore((s) => s.targetLanguage)
    const effectiveTargetLanguage = useTranslateStore((s) => s.effectiveTargetLanguage)
    const setSourceText = useTranslateStore((s) => s.setSourceText)

    const serviceInstances = useConfigStore((s) => s.config.service_instances)

    const playingCleanupRef = useRef<(() => void) | null>(null)
    const playingRequestRef = useRef(0)
    const playingActiveRef = useRef(false)
    const [playingKey, setPlayingKey] = useState<string | null>(null)
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [manuallyCollapsedKeys, setManuallyCollapsedKeys] = useState<Set<string>>(new Set())

    // Clear manual collapse state when a new translation starts so that
    // arriving results auto-expand. (Cards default to collapsed when their
    // key is not yet present in `results`.)
    useEffect(() => {
        if (isTranslating) {
            setManuallyCollapsedKeys(new Set())
        }
    }, [isTranslating])

    const toggleCollapse = useCallback((key: string) => {
        setManuallyCollapsedKeys((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const handleCopy = useCallback((text: string) => {
        window.electronAPI.text.writeClipboard(text).catch(() => undefined)
    }, [])

    const handleReverseTranslate = useCallback((text: string) => {
        setSourceText(text)
    }, [setSourceText])

    const handleTts = useCallback((text: string, key: string) => {
        if (playingActiveRef.current || busyKey) {
            playingRequestRef.current += 1
            playingActiveRef.current = false
            playingCleanupRef.current?.()
            playingCleanupRef.current = null
            setPlayingKey(null)
            setBusyKey(null)
            return
        }

        const instanceKey = ttsServiceList[0]
        if (!instanceKey) return
        const svcKey = getServiceKey(instanceKey)
        const ttsService = ttsServiceRegistry.get(svcKey)
        if (!ttsService) return

        const request_id = playingRequestRef.current + 1
        playingRequestRef.current = request_id
        playingActiveRef.current = true
        setBusyKey(key)
        try {
            const instanceConfig = get_service_config(serviceInstances, instanceKey)
            const language = effectiveTargetLanguage ?? targetLanguage

            const handle = ttsService.play(text, language, instanceConfig)
            setBusyKey(null)
            setPlayingKey(key)
            const reset = (): void => {
                if (playingRequestRef.current === request_id) {
                    playingActiveRef.current = false
                    setPlayingKey(null)
                    setBusyKey(null)
                }
                if (playingCleanupRef.current === reset) {
                    playingCleanupRef.current = null
                }
            }
            playingCleanupRef.current = () => { handle.stop(); reset() }
            handle.done.then(reset, reset)
        } catch {
            if (playingRequestRef.current === request_id) {
                playingActiveRef.current = false
                setPlayingKey(null)
                setBusyKey(null)
            }
        }
    }, [busyKey, targetLanguage, effectiveTargetLanguage, ttsServiceList, serviceInstances])

    useEffect(() => {
        return () => {
            playingRequestRef.current += 1
            playingActiveRef.current = false
            setBusyKey(null)
            const cleanup = playingCleanupRef.current
            playingCleanupRef.current = null
            cleanup?.()
        }
    }, [])

    const sensors = useMemo<SensorDescriptor<SensorOptions>[]>(() => [{
        sensor: PointerSensor,
        options: { activationConstraint: { distance: 5 } },
    }], [])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIdx = serviceList.indexOf(String(active.id))
        const newIdx = serviceList.indexOf(String(over.id))
        if (oldIdx === -1 || newIdx === -1) return

        const enabledList = [...serviceList]
        const [moved] = enabledList.splice(oldIdx, 1) as [string]
        enabledList.splice(newIdx, 0, moved)
        const enabledSet = new Set(serviceList)
        let enabledIdx = 0
        const updated = useConfigStore.getState().config.translate_service_list.map((instanceKey) => {
            if (!enabledSet.has(instanceKey)) return instanceKey
            const [reorderedKey] = enabledList.slice(enabledIdx, enabledIdx + 1) as [string]
            enabledIdx += 1
            return reorderedKey
        })
        useConfigStore.getState().set('translate_service_list', updated)
    }, [serviceList])

    if (!hasAnyRequest) return null

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={serviceList} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {serviceList.map((instanceKey) => (
                        <SortableCard
                            key={instanceKey}
                            instanceKey={instanceKey}
                            results={results}
                            isTranslating={isTranslating}
                            collapsed={!(instanceKey in results) || manuallyCollapsedKeys.has(instanceKey)}
                            onToggleCollapse={toggleCollapse}
                            onRetry={onRetry}
                            onCopy={handleCopy}
                            onTts={(text, key) => { handleTts(text, key) }}
                            onReverseTranslate={handleReverseTranslate}
                            playingKey={playingKey}
                            busyKey={busyKey}
                            ttsAvailable={ttsServiceList.length > 0}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    )
}
