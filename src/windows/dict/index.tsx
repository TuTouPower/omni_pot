import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useDictStore } from '../../stores/dict_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { collectionServiceRegistry } from '../../services/index'
import { getServiceKey } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import type { DictResult, ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'

function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

function dict_result_to_text(result: DictResult): string {
    return result.definitions
        .map((d) => `${d.partOfSpeech} ${d.meanings.join('; ')}`)
        .join('\n')
}

function DictResultCard({ instanceKey, result, isCollected, onCollect, collectionAvailable, collapsed, onToggleCollapse }: {
    instanceKey: string; result: DictResult | null
    isCollected?: boolean; onCollect?: () => void; collectionAvailable?: boolean
    collapsed?: boolean; onToggleCollapse?: () => void
}): React.ReactElement | null {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)
    const serviceKey = getServiceKey(instanceKey)
    const service = translateServiceRegistry.get(serviceKey)
    if (!service) return null

    if (result === null) {
        return (
            <div className="card" data-testid="dict-card" data-result-key={instanceKey} style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div data-testid="dict-source-tag" style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{service.name}</div>
                    {onToggleCollapse && (
                        <button className="ic-btn" data-testid="dict-collapse-btn" aria-expanded={!collapsed} onClick={onToggleCollapse}>
                            <Icons.Chev size={14} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
                        </button>
                    )}
                </div>
                {!collapsed && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 6 }}>{t('dict.lookup_failed')}</p>}
            </div>
        )
    }

    const handleCopy = () => {
        const text = dict_result_to_text(result)
        window.electronAPI.text.writeClipboard(text).catch(() => undefined)
        setCopied(true)
        setTimeout(() => { setCopied(false); }, 1500)
    }

    return (
        <>
            {/* Definitions card */}
            <div className="card" data-testid="dict-card" data-result-key={instanceKey} style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div data-testid="dict-source-tag" style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{service.name}</div>
                    {onCollect && (
                        <button
                            className="ic-btn"
                            data-testid="dict-collect-btn"
                            title={t('result.collect', { defaultValue: '收藏' })}
                            aria-pressed={isCollected}
                            disabled={!collectionAvailable}
                            onClick={onCollect}
                            style={{ color: isCollected ? 'var(--brand-primary)' : undefined }}
                        >
                            <Icons.Heart size={14} fill={isCollected} />
                        </button>
                    )}
                    {onToggleCollapse && (
                        <button className="ic-btn" data-testid="dict-collapse-btn" aria-expanded={!collapsed} onClick={onToggleCollapse}>
                            <Icons.Chev size={14} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
                        </button>
                    )}
                </div>
                {!collapsed && (
                    <>
                        <div data-testid="dict-definitions" className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 10, marginBottom: 10 }}>
                            {t('dict.definitions', { defaultValue: '释义' })}
                        </div>
                        <div className="stack" style={{ gap: 12 }}>
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
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                            <button className="ic-btn" data-testid="dict-copy-btn" title={copied ? (t('dict.copied', { defaultValue: '已复制' })) : (t('result.copy', { defaultValue: '复制' }))} onClick={handleCopy}>
                                <Icons.Copy size={14} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Examples card */}
            {!collapsed && result.examples.length > 0 && (
                <div className="card" data-testid="dict-examples" style={{ padding: '12px 14px' }}>
                    <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                        {t('dict.examples', { defaultValue: '例句' })}
                    </div>
                    <div className="stack" style={{ gap: 10 }}>
                        {result.examples.map((ex, i) => (
                            <div key={i} data-testid="dict-example" style={{ borderLeft: '2px solid var(--line-strong)', paddingLeft: 10 }}>
                                <div style={{ fontSize: 13, lineHeight: 1.55 }}>{ex.source}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}

function service_supports_dictionary_query(service_key: string, source_language: LanguageCode): boolean {
    if (source_language === 'en') {
        // English source → English dictionaries. CC-CEDICT also indexes English glosses,
        // so it can find Chinese translations for English headwords.
        return ['free_dictionary', 'ecdict', 'cambridge_dict'].includes(service_key)
    }
    // Chinese (or auto-detected as zh) source → Chinese dictionaries. Both the local
    // chinese-dictionary DB and CC-CEDICT have Chinese headwords.
    return service_key === 'chinese_dictionary' || service_key === 'ecdict'
}

export default function DictWindow(): React.ReactElement {
    const { t } = useTranslation()
    const word = useDictStore((s) => s.word)
    const results = useDictStore((s) => s.results)
    const isLoading = useDictStore((s) => s.isLoading)
    const setWord = useDictStore((s) => s.setWord)
    const setResult = useDictStore((s) => s.setResult)
    const setIsLoading = useDictStore((s) => s.setIsLoading)
    const clearResults = useDictStore((s) => s.clearResults)

    const serviceList = useConfigStore((s) => s.config.dictionary_service_list)
    const collectionServiceList = useConfigStore((s) => s.config.collection_service_list)
    const serviceInstances = useConfigStore((s) => s.config.service_instances)
    const enabledServiceList = useMemo(
        () => serviceList.filter((instanceKey) => get_service_config(serviceInstances, instanceKey).enable !== false),
        [serviceList, serviceInstances]
    )
    const enabledCollectionServiceList = useMemo(
        () => collectionServiceList.filter((instanceKey) => get_service_config(serviceInstances, instanceKey).enable !== false),
        [collectionServiceList, serviceInstances]
    )
    const alwaysOnTop = useConfigStore((s) => s.config.translate_always_on_top)

    const [dictReady, setDictReady] = useState<boolean | null>(null)
    const [selection_notice, setSelectionNotice] = useState(false)
    const [importing, setImporting] = useState(false)
    const [collectedKeys, setCollectedKeys] = useState<Set<string>>(new Set())
    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())
    const [ttsPlaying, setTtsPlaying] = useState(false)
    const lookup_request_ref = useRef(0)

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
        const source_language = /^[a-zA-Z]/.test(lookupWord) ? 'en' : 'zh_cn'
        const target_language = source_language === 'en' ? 'zh_cn' : 'en'

        const promises = enabledServiceList.map(async (instanceKey) => {
            const serviceKey = getServiceKey(instanceKey)
            if (!service_supports_dictionary_query(serviceKey, source_language)) return
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
    }, [enabledServiceList, serviceInstances, setWord, setIsLoading, clearResults, setResult])

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
        window.electronAPI.window.setAlwaysOnTop(!alwaysOnTop).catch(console.error)
    }, [alwaysOnTop])

    const firstResult = enabledServiceList.map((ik) => results[ik]).find((r): r is DictResult => !!r)
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

    const handleTts = useCallback(() => {
        if (!word.trim() || ttsServiceList.length === 0) return
        const instanceKey = ttsServiceList[0]
        if (!instanceKey) return
        const svcKey = getServiceKey(instanceKey)
        const ttsService = ttsServiceRegistry.get(svcKey)
        if (!ttsService) return

        if (ttsPlaying) {
            setTtsPlaying(false)
            return
        }

        setTtsPlaying(true)
        const instanceConfig = get_service_config(serviceInstances, instanceKey)
        try {
            const handle = ttsService.play(word.trim(), 'en', instanceConfig)
            handle.done.then(() => { setTtsPlaying(false) }, () => { setTtsPlaying(false) })
        } catch {
            setTtsPlaying(false)
        }
    }, [word, ttsServiceList, serviceInstances, ttsPlaying])

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
                <span className="op-mode" data-testid="titlebar-mode">字典词典</span>
                <div style={{ flex: 1 }} />
                <button className="ic-btn" title="关闭" data-testid="titlebar-close" onClick={handleClose}>
                    <Icons.Close size={14} />
                </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '4px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Word header card */}
                <div className="card" data-testid="dict-card" style={{ padding: '16px 16px 18px', overflow: 'visible' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                                <div
                                    data-testid="dict-word"
                                    style={{
                                        fontSize: 24,
                                        fontWeight: 600,
                                        letterSpacing: '-0.01em',
                                        color: 'var(--text)',
                                        minHeight: 30,
                                    }}
                                >
                                    {word || t('dict.source_placeholder')}
                                </div>
                                {word.trim() && ttsAvailable && (
                                    <button
                                        className={'ic-btn' + (ttsPlaying ? ' brand' : '')}
                                        data-testid="dict-tts-btn"
                                        title={ttsPlaying ? t('tts_stop', { defaultValue: '停止朗读' }) : t('result.tts', { defaultValue: '朗读' })}
                                        onClick={handleTts}
                                        style={ttsPlaying ? { background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)' } : undefined}
                                    >
                                        <Icons.Volume size={16} fill={ttsPlaying} />
                                    </button>
                                )}
                            </div>
                            {firstResult && firstResult.pronunciations.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                    {firstResult.pronunciations.map((p, i) => (
                                        <span key={i} data-testid="dict-pronunciation" className="mono" style={{ color: 'var(--text-mute)', fontSize: 12.5 }}>
                                            {p.region && `${p.region} `}{p.phonetic}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {firstResult && firstResult.definitions.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                    {firstResult.definitions.map((def, i) => (
                                        <span key={i} data-testid="dict-pos-tag" className="chip plain mono" style={{ fontSize: 10 }}>{def.partOfSpeech}</span>
                                    ))}
                                </div>
                            )}
                        </div>
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

                {/* Loading */}
                {isLoading && Object.keys(results).length === 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-mute)' }}>查询中…</span>
                    </div>
                )}

                {/* Results */}
                {enabledServiceList.map((instanceKey) => {
                    if (!Object.prototype.hasOwnProperty.call(results, instanceKey)) return null
                    return (
                        <DictResultCard
                            key={instanceKey}
                            instanceKey={instanceKey}
                            result={results[instanceKey] ?? null}
                            isCollected={collectedKeys.has(instanceKey)}
                            onCollect={() => { handleCollect(instanceKey).catch(console.error); }}
                            collectionAvailable={collection_available}
                            collapsed={collapsedKeys.has(instanceKey)}
                            onToggleCollapse={() => { toggleCollapse(instanceKey); }}
                        />
                    )
                })}

            </div>
        </div>
    )
}
