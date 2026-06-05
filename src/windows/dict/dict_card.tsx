import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { SvcTile, svcLabel } from '../../components/svc_tile'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { translateServiceRegistry } from '../../services/registry'
import { getServiceKey } from '@shared/types/service'
import { dict_result_to_text } from './dict_helpers'
import type { DictResult } from '@shared/types/service'

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
