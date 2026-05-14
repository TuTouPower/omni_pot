import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { collectionServiceRegistry } from '../../services/index'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { getServiceKey } from '@shared/types/service'
import type { DictResult } from '@shared/types/service'

interface TargetAreaProps {
    serviceList: string[]
    ttsServiceList: string[]
    onRetry?: (instanceKey: string) => void
}

// Service brand monograms
const SVC_META: Record<string, { name: string; mono: string; tone: string }> = {
    deepl: { name: 'DeepL', mono: 'DL', tone: 'oklch(70% 0.10 240)' },
    bing: { name: 'Bing', mono: 'BG', tone: 'oklch(65% 0.10 200)' },
    google: { name: 'Google', mono: 'GG', tone: 'oklch(68% 0.10 130)' },
    yandex: { name: 'Yandex', mono: 'YD', tone: 'oklch(65% 0.13 25)' },
    lingva: { name: 'Lingva', mono: 'LV', tone: 'oklch(65% 0.10 170)' },
    ecdict: { name: 'ECDict', mono: 'EC', tone: 'oklch(64% 0.10 60)' },
    openai: { name: 'OpenAI', mono: 'AI', tone: 'oklch(58% 0.02 180)' },
    geminipro: { name: 'Gemini', mono: 'GM', tone: 'oklch(64% 0.12 280)' },
    chatglm: { name: 'ChatGLM', mono: 'GL', tone: 'oklch(60% 0.12 30)' },
    ollama: { name: 'Ollama', mono: 'OL', tone: 'oklch(55% 0.005 70)' },
    baidu: { name: '百度', mono: 'BD', tone: 'oklch(58% 0.16 250)' },
    baidu_field: { name: '百度领域', mono: 'BF', tone: 'oklch(58% 0.16 250)' },
    bing_dict: { name: 'Bing 词典', mono: 'BD', tone: 'oklch(65% 0.10 200)' },
    caiyun: { name: '彩云小译', mono: 'CY', tone: 'oklch(70% 0.12 220)' },
    cambridge_dict: { name: 'Cambridge', mono: 'CD', tone: 'oklch(58% 0.13 25)' },
    alibaba: { name: '阿里巴巴', mono: 'AB', tone: 'oklch(60% 0.15 30)' },
    tencent: { name: '腾讯', mono: 'TC', tone: 'oklch(60% 0.13 230)' },
    transmart: { name: 'TranSmart', mono: 'TS', tone: 'oklch(60% 0.13 230)' },
    volcengine: { name: '火山引擎', mono: 'VE', tone: 'oklch(60% 0.13 25)' },
    niutrans: { name: '牛翻译', mono: 'NT', tone: 'oklch(64% 0.12 145)' },
    youdao: { name: '有道', mono: 'YD', tone: 'oklch(58% 0.13 25)' },
    mymemory: { name: 'MyMemory', mono: 'MM', tone: 'oklch(60% 0.10 60)' },
    free_dictionary: { name: 'FreeDict', mono: 'FD', tone: 'oklch(60% 0.10 145)' },
    system: { name: '系统 OCR', mono: 'SY', tone: 'oklch(54% 0.005 70)' },
    tesseract: { name: 'Tesseract', mono: 'TE', tone: 'oklch(58% 0.10 50)' },
    baidu_ocr: { name: '百度 OCR', mono: 'BD', tone: 'oklch(58% 0.16 250)' },
    baidu_accurate_ocr: { name: '百度高精度', mono: 'BA', tone: 'oklch(58% 0.16 250)' },
    tencent_ocr: { name: '腾讯 OCR', mono: 'TC', tone: 'oklch(60% 0.13 230)' },
    iflytek_ocr: { name: '讯飞 OCR', mono: 'IF', tone: 'oklch(60% 0.13 220)' },
    iflytek_latex_ocr: { name: '讯飞 LaTeX', mono: 'TX', tone: 'oklch(60% 0.13 220)' },
    openai_compatible: { name: 'AI 视觉', mono: 'VL', tone: 'oklch(58% 0.02 180)' },
    qrcode: { name: '二维码', mono: 'QR', tone: 'oklch(50% 0.01 70)' },
    edge_tts: { name: 'Edge TTS', mono: 'ED', tone: 'oklch(60% 0.13 230)' },
    lingva_tts: { name: 'Lingva TTS', mono: 'LV', tone: 'oklch(65% 0.10 170)' },
    anki: { name: 'Anki', mono: 'AK', tone: 'oklch(58% 0.13 25)' },
    eudic: { name: '欧路词典', mono: 'EU', tone: 'oklch(60% 0.13 145)' },
}

function SvcTile({ name, size = 24 }: { name: string; size?: number }): React.ReactElement {
    const m = SVC_META[name] || { mono: name.slice(0, 2).toUpperCase(), tone: 'oklch(55% 0.005 70)' }
    return (
        <div
            className={'svc-tile' + (size >= 32 ? ' lg' : '')}
            style={{
                color: m.tone,
                borderColor: 'color-mix(in oklab, ' + m.tone + ' 30%, var(--line))',
            }}
        >
            {m.mono}
        </div>
    )
}

function svcLabel(name: string): string {
    return (SVC_META[name] || {}).name || name
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
    onCollect: (key: string) => void
    onReverseTranslate: (text: string) => void
    playingKey: string | null
    collectedKeys: Set<string>
    ttsAvailable: boolean
    collectionAvailable: boolean
}

function SortableCard({
    instanceKey, results, collapsed, onToggleCollapse, onRetry,
    onCopy, onTts, onCollect, onReverseTranslate,
    playingKey, collectedKeys, ttsAvailable, collectionAvailable,
}: SortableCardProps): React.ReactElement | null {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: instanceKey })
    const serviceKey = getServiceKey(instanceKey)
    const service = translateServiceRegistry.get(serviceKey)
    if (!service) return null

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    const result = results[instanceKey]
    const isStreaming = results[instanceKey] !== undefined && results[instanceKey] !== null && typeof results[instanceKey] === 'string'

    return (
        <div ref={setNodeRef} style={style}>
            <div className="card" data-testid="result-card" data-result-key={instanceKey} style={{ padding: '10px 12px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--text-mute)' }}>
                        <Icons.Drag size={14} />
                    </span>
                    <SvcTile name={serviceKey} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{svcLabel(serviceKey)}</div>
                    {isStreaming && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)' }}>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 99, background: 'var(--brand-primary)' }} />
                            stream
                        </span>
                    )}
                    <div style={{ flex: 1 }} />
                    <button data-testid="result-tts" className="ic-btn" title="朗读" onClick={() => {
                        const r = results[instanceKey]
                        if (typeof r === 'string') onTts(r, instanceKey)
                    }}>
                        <Icons.Volume size={16} />
                    </button>
                    <button data-testid="result-copy" className="ic-btn" title="复制" onClick={() => {
                        const r = results[instanceKey]
                        if (typeof r === 'string') onCopy(r)
                    }}>
                        <Icons.Copy size={16} />
                    </button>
                    <button data-testid="result-collect" className="ic-btn" title="收藏" onClick={() => onCollect(instanceKey)}>
                        <Icons.Heart size={16} />
                    </button>
                    <button data-testid="result-collapse" className="ic-btn" title={collapsed ? '展开' : '收起'} onClick={() => onToggleCollapse(instanceKey)}>
                        <Icons.Chev size={17} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
                    </button>
                </div>

                {/* Content */}
                {!collapsed && (
                    result === null ? (
                        <div data-testid="result-error" data-result-error style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--danger)', fontSize: 13 }}>翻译失败</span>
                            {onRetry && (
                                <button data-testid="result-retry" className="ic-btn" title="重试" onClick={() => onRetry(instanceKey)} style={{ color: 'var(--danger)' }}>
                                    <Icons.Cycle size={14} />
                                </button>
                            )}
                        </div>
                    ) : result === undefined ? null : (
                        <div data-testid="result-body" data-result-content style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}>
                            {typeof result === 'string'
                                ? (result || <span style={{ color: 'var(--text-mute)' }}>…</span>)
                                : <DictResultInline result={result as DictResult} />
                            }
                        </div>
                    )
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
                    <span className="chip plain mono" style={{ fontSize: 10, marginRight: 6 }}>{def.partOfSpeech}</span>
                    {def.meanings.join('; ')}
                </div>
            ))}
            {result.examples.length > 0 && (
                <div style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                    {result.examples.slice(0, 3).map((ex, i) => (
                        <p key={i} style={{ fontSize: 12.5, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 4 }}>{ex.source}</p>
                    ))}
                </div>
            )}
        </div>
    )
}

export function TargetArea({ serviceList, ttsServiceList, onRetry }: TargetAreaProps): React.ReactElement {
    const { t } = useTranslation()
    const results = useTranslateStore((s) => s.results)
    const isTranslating = useTranslateStore((s) => s.isTranslating)
    const sourceText = useTranslateStore((s) => s.sourceText)
    const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
    const targetLanguage = useTranslateStore((s) => s.targetLanguage)
    const setSourceText = useTranslateStore((s) => s.setSourceText)

    const collectionServiceList = useConfigStore((s) => s.config.collection_service_list)
    const serviceInstances = useConfigStore((s) => s.config.service_instances)

    const playingRef = useRef<HTMLAudioElement | null>(null)
    const [playingKey, setPlayingKey] = useState<string | null>(null)
    const [collectedKeys, setCollectedKeys] = useState<Set<string>>(new Set())
    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())

    const toggleCollapse = useCallback((key: string) => {
        setCollapsedKeys((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const handleCopy = useCallback((text: string) => {
        navigator.clipboard.writeText(text)
    }, [])

    const handleReverseTranslate = useCallback((text: string) => {
        setSourceText(text)
    }, [setSourceText])

    const handleTts = useCallback(async (text: string, key: string) => {
        if (playingRef.current) {
            playingRef.current.pause()
            playingRef.current = null
            setPlayingKey(null)
            return
        }

        const instanceKey = ttsServiceList[0]
        if (!instanceKey) return
        const svcKey = getServiceKey(instanceKey)
        const ttsService = ttsServiceRegistry.get(svcKey)
        if (!ttsService) return

        try {
            setPlayingKey(key)
            const audioBuffer = await ttsService.synthesize(text, targetLanguage, {})
            const blob = new Blob([audioBuffer], { type: 'audio/mp3' })
            const url = URL.createObjectURL(blob)
            const audio = new Audio(url)
            playingRef.current = audio
            audio.onended = () => {
                playingRef.current = null
                setPlayingKey(null)
                URL.revokeObjectURL(url)
            }
            audio.onerror = () => {
                playingRef.current = null
                setPlayingKey(null)
                URL.revokeObjectURL(url)
            }
            audio.play()
        } catch {
            setPlayingKey(null)
        }
    }, [targetLanguage, ttsServiceList])

    const handleCollect = useCallback(async (instanceKey: string) => {
        const result = results[instanceKey]
        if (!result || !sourceText.trim()) return

        const resultText = typeof result === 'string'
            ? result
            : (result as DictResult).definitions.map((d) => d.meanings.join('; ')).join('\n')

        for (const collInstanceKey of collectionServiceList) {
            const collKey = getServiceKey(collInstanceKey)
            const svc = collectionServiceRegistry.get(collKey)
            if (!svc) continue
            const cfg = serviceInstances[collInstanceKey]?.config ?? {}
            try {
                await svc.send(sourceText, sourceLanguage, targetLanguage, resultText, cfg)
            } catch { /* skip failed services */ }
        }

        setCollectedKeys((prev) => new Set(prev).add(instanceKey))
    }, [results, sourceText, sourceLanguage, targetLanguage, collectionServiceList, serviceInstances])

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    const handleDragEnd = useCallback((event: { active: { id: string | number }; over: { id: string | number } | null }) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const list = useConfigStore.getState().config.translate_service_list
        const oldIdx = list.indexOf(String(active.id))
        const newIdx = list.indexOf(String(over.id))
        if (oldIdx === -1 || newIdx === -1) return
        const updated = [...list]
        const [moved] = updated.splice(oldIdx, 1)
        updated.splice(newIdx, 0, moved)
        useConfigStore.getState().set('translate_service_list', updated)
    }, [])

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={serviceList} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
                    {serviceList.map((instanceKey) => (
                        <SortableCard
                            key={instanceKey}
                            instanceKey={instanceKey}
                            results={results}
                            isTranslating={isTranslating}
                            collapsed={collapsedKeys.has(instanceKey)}
                            onToggleCollapse={toggleCollapse}
                            onRetry={onRetry}
                            onCopy={handleCopy}
                            onTts={handleTts}
                            onCollect={handleCollect}
                            onReverseTranslate={handleReverseTranslate}
                            playingKey={playingKey}
                            collectedKeys={collectedKeys}
                            ttsAvailable={ttsServiceList.length > 0}
                            collectionAvailable={collectionServiceList.length > 0}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    )
}
