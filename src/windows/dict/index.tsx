import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useDictStore } from '../../stores/dict_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { getServiceKey } from '@shared/types/service'
import type { DictResult } from '@shared/types/service'

function DictResultCard({ instanceKey, result }: { instanceKey: string; result: DictResult | null }): React.ReactElement | null {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)
    const serviceKey = getServiceKey(instanceKey)
    const service = translateServiceRegistry.get(serviceKey)
    if (!service) return null

    if (result === null) {
        return (
            <div className="card" data-testid="dict-card" data-result-key={instanceKey} style={{ padding: '12px 14px' }}>
                <div data-testid="dict-source-tag" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{service.name}</div>
                <p style={{ color: 'var(--danger)', fontSize: 13 }}>{t('dict.lookup_failed')}</p>
            </div>
        )
    }

    const handleCopy = () => {
        const text = result.definitions
            .map((d) => `${d.partOfSpeech} ${d.meanings.join('; ')}`)
            .join('\n')
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <>
            {/* Definitions card */}
            <div className="card" data-testid="dict-card" data-result-key={instanceKey} style={{ padding: '12px 14px' }}>
                <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                    {t('dict.definitions') || '释义'}
                </div>
                <div className="stack" style={{ gap: 12 }}>
                    {result.definitions.map((def, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10 }}>
                            <div style={{ width: 22, color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 11, paddingTop: 3 }}>
                                {String(i + 1).padStart(2, '0')}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className="chip plain mono" style={{ fontSize: 10 }}>{def.partOfSpeech}</span>
                                    <span style={{ fontSize: 14, fontWeight: 500 }}>{def.meanings.join('; ')}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="ic-btn" title={copied ? '已复制' : '复制'} onClick={handleCopy}>
                        <Icons.Copy size={14} />
                    </button>
                </div>
            </div>

            {/* Pronunciations card */}
            {result.pronunciations.length > 0 && (
                <div className="card" style={{ padding: '12px 14px' }}>
                    <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                        {t('dict.pronunciations') || '发音'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {result.pronunciations.map((p, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {p.region && <span className="chip plain mono" style={{ fontSize: 10 }}>{p.region}</span>}
                                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{p.phonetic}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Examples card */}
            {result.examples.length > 0 && (
                <div className="card" style={{ padding: '12px 14px' }}>
                    <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                        {t('dict.examples') || '例句'}
                    </div>
                    <div className="stack" style={{ gap: 10 }}>
                        {result.examples.slice(0, 3).map((ex, i) => (
                            <div key={i} style={{ borderLeft: '2px solid var(--line-strong)', paddingLeft: 10 }}>
                                <div style={{ fontSize: 13, lineHeight: 1.55 }}>{ex.source}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
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
    const serviceInstances = useConfigStore((s) => s.config.service_instances)
    const alwaysOnTop = useConfigStore((s) => s.config.translate_always_on_top)

    const [dictReady, setDictReady] = useState<boolean | null>(null)
    const [importing, setImporting] = useState(false)

    useEffect(() => {
        window.electronAPI.dict.check().then(({ ready }) => setDictReady(ready))
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

        setWord(trimmed)
        setIsLoading(true)
        clearResults()

        const lookupWord = trimmed.split(' ')[0]

        const promises = serviceList.map(async (instanceKey) => {
            const serviceKey = getServiceKey(instanceKey)
            const service = translateServiceRegistry.get(serviceKey)
            if (!service) {
                setResult(instanceKey, null)
                return
            }
            const instanceConfig = serviceInstances[instanceKey]?.config ?? {}
            try {
                const result = await service.translate(lookupWord, 'en', 'zh_cn', instanceConfig)
                if (typeof result === 'object' && result.type === 'dict') {
                    setResult(instanceKey, result)
                } else {
                    setResult(instanceKey, null)
                }
            } catch {
                setResult(instanceKey, null)
            }
        })

        await Promise.allSettled(promises)
        setIsLoading(false)
    }, [serviceList, serviceInstances, setWord, setIsLoading, clearResults, setResult])

    useEffect(() => {
        const unsub = window.electronAPI.text.onDictLookup((text: string) => {
            if (!text.trim()) return
            handleLookup(text)
        })
        return unsub
    }, [handleLookup])

    useEffect(() => {
        window.electronAPI.ready('dict')
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') window.electronAPI.window.close()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleClose = useCallback(() => window.electronAPI.window.close(), [])
    const handleTogglePin = useCallback(() => {
        window.electronAPI.window.setAlwaysOnTop(!alwaysOnTop)
    }, [alwaysOnTop])

    const handleManualLookup = useCallback(() => {
        if (word.trim()) handleLookup(word)
    }, [word, handleLookup])

    // Get first result for the header display
    const firstResult = serviceList.map((ik) => results[ik]).find((r) => r !== undefined && r !== null) as DictResult | null | undefined

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
                    <span className="dot" style={{ background: 'var(--brand-primary)' }} />
                    omni_pot
                </div>
                <span className="op-mode" data-testid="titlebar-mode">· 词典</span>
                <div style={{ flex: 1 }} />
                <button className="ic-btn" title="关闭" data-testid="titlebar-close" onClick={handleClose}>
                    <Icons.Close size={14} />
                </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '4px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Word header card */}
                <div className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                                <input
                                    data-testid="dict-word"
                                    value={word}
                                    onChange={(e) => setWord(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleManualLookup() }}
                                    placeholder={t('dict.source_placeholder')}
                                    style={{
                                        fontSize: 24,
                                        fontWeight: 600,
                                        letterSpacing: '-0.01em',
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        color: 'var(--text)',
                                        fontFamily: 'inherit',
                                        padding: 0,
                                        width: '100%',
                                        maxWidth: 300,
                                    }}
                                />
                            </div>
                            {firstResult && firstResult.pronunciations.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                    {firstResult.pronunciations.map((p, i) => (
                                        <span key={i} className="mono" style={{ color: 'var(--text-mute)', fontSize: 12.5 }}>
                                            {p.region && `${p.region} `}{p.phonetic}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {firstResult && firstResult.definitions.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                    {firstResult.definitions.map((def, i) => (
                                        <span key={i} className="chip plain mono" style={{ fontSize: 10 }}>{def.partOfSpeech}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Dictionary not ready */}
                {dictReady === false && (
                    <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>CC-CEDICT dictionary not downloaded</p>
                        <button className="btn primary" onClick={handleImport} disabled={importing}>
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
                {serviceList.map((instanceKey) => {
                    const result = results[instanceKey]
                    if (result === undefined) return null
                    return <DictResultCard key={instanceKey} instanceKey={instanceKey} result={result} />
                })}

                {/* Source attribution */}
                {serviceList.length > 0 && Object.keys(results).length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px 0' }}>
                        <span className="hint mono">来源</span>
                        {serviceList.map((ik) => {
                            const sk = getServiceKey(ik)
                            const svc = translateServiceRegistry.get(sk)
                            return svc ? <span key={ik} className="chip plain mono" style={{ fontSize: 10 }}>{svc.name}</span> : null
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
