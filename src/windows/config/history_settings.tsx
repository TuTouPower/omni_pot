import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfig } from '../../hooks/use_config'
import type { HistoryRecord } from '@shared/types/ipc'
import { ConfigSwitch } from './config_components'

const PAGE_SIZE = 20

const TIME_FILTERS = [
    { value: 0, label: '全部时间' },
    { value: 1, label: '最近 1 天' },
    { value: 7, label: '最近 7 天' },
    { value: 30, label: '最近 30 天' },
] as const

export default function HistorySettings(): React.ReactElement {
    const { t } = useTranslation()
    const [historyDisable, setHistoryDisable] = useConfig('history_disable')
    const [records, setRecords] = useState<HistoryRecord[]>([])
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [selected, setSelected] = useState<HistoryRecord | null>(null)
    const [editSource, setEditSource] = useState('')
    const [editTarget, setEditTarget] = useState('')
    const [search, setSearch] = useState('')
    const [serviceFilter, setServiceFilter] = useState('')
    const [timeFilter, setTimeFilter] = useState(0)

    const load_page = useCallback(async (p: number) => {
        const api = window.electronAPI
        const filters: { search?: string; service_key?: string; days?: number } = {}
        if (search.trim()) filters.search = search.trim()
        if (serviceFilter) filters.service_key = serviceFilter
        if (timeFilter > 0) filters.days = timeFilter
        const count = await api.history.count(Object.keys(filters).length > 0 ? filters : undefined)
        setTotal(count)
        const rows = await api.history.list(p, PAGE_SIZE, Object.keys(filters).length > 0 ? filters : undefined)
        setRecords(rows)
    }, [search, serviceFilter, timeFilter])

    useEffect(() => { load_page(page).catch(console.error) }, [page, load_page])

    const total_pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const handle_clear = async (): Promise<void> => {
        await window.electronAPI.history.clear()
        setPage(1)
        setSearch('')
        setServiceFilter('')
        setTimeFilter(0)
        load_page(1).catch(console.error)
    }

    const handle_select = (record: HistoryRecord): void => {
        setSelected(record)
        setEditSource(record.source_text)
        setEditTarget(record.target_text)
    }

    const handle_save = async (): Promise<void> => {
        if (!selected) return
        await window.electronAPI.history.update(selected.id, editSource, editTarget)
        setSelected(null)
        load_page(page).catch(console.error)
    }

    const disabled = historyDisable

    return (
        <div className="stack gap-12">
            {/* Unified toolbar */}
            <div style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: '8px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--line)',
                borderRadius: 10,
            }}>
                <ConfigSwitch on={historyDisable} onChange={setHistoryDisable} testId="cfg-history_disable" />
                <span style={{ fontSize: 12, color: 'var(--text-dim)', marginRight: 4 }}>{t('history.disable', { defaultValue: '禁用历史记录' })}</span>
                <div style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 4px' }} />
                <div className="field" style={{ flex: 1, minWidth: 160, opacity: disabled ? 0.5 : 1 }}>
                    <input
                        data-testid="history-search"
                        placeholder={t('ui.search', { defaultValue: '搜索...' })}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        disabled={disabled}
                        style={{ fontSize: 12 }}
                    />
                </div>
                <select
                    data-testid="history-service-filter"
                    value={serviceFilter}
                    onChange={(e) => { setServiceFilter(e.target.value); setPage(1); }}
                    disabled={disabled}
                    style={{ fontSize: 12, opacity: disabled ? 0.5 : 1, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)' }}
                >
                    <option value="">全部服务</option>
                    <option value="bing">Bing</option>
                    <option value="deepl">DeepL</option>
                    <option value="mymemory">MyMemory</option>
                </select>
                <select
                    data-testid="history-time-filter"
                    value={timeFilter}
                    onChange={(e) => { setTimeFilter(Number(e.target.value)); setPage(1); }}
                    disabled={disabled}
                    style={{ fontSize: 12, opacity: disabled ? 0.5 : 1, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)' }}
                >
                    {TIME_FILTERS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                </select>
                <div style={{ flex: 1 }} />
                <button data-testid="history-clear" className="btn sm danger" onClick={() => { handle_clear().catch(console.error); }} disabled={disabled} style={{ opacity: disabled ? 0.5 : 1 }}>
                    <Icons.Trash size={12} />
                    {t('history.clear', { defaultValue: '清空' })}
                </button>
            </div>

            {/* Records table */}
            {records.length > 0 && (
                <div data-testid="history-list" className="card" style={{ padding: 0, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : undefined }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 110px 120px 1fr 120px',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--line)',
                        background: 'var(--bg-sunk)',
                        fontSize: 11,
                        color: 'var(--text-mute)',
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '.05em',
                    }}>
                        <div>源文本</div>
                        <div>语言</div>
                        <div>服务</div>
                        <div>译文</div>
                        <div>时间</div>
                    </div>
                    {records.map((r, i) => (
                        <div
                            key={r.id}
                            data-testid="history-row"
                            data-history-id={r.id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 110px 120px 1fr 120px',
                                alignItems: 'center',
                                padding: '10px 14px',
                                borderBottom: i < records.length - 1 ? '1px solid var(--line)' : 'none',
                                cursor: 'pointer',
                                transition: 'background .12s',
                                gap: 12,
                            }}
                            onClick={() => { handle_select(r); }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <div data-testid="history-source" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{r.source_text}</div>
                            <div data-testid="history-language" className="hint mono" style={{ fontSize: 11 }}>{r.source_lang} → {r.target_lang}</div>
                            <div data-testid="history-service" className="hint mono" style={{ fontSize: 11 }}>{r.service_key}</div>
                            <div data-testid="history-target" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-dim)' }}>{r.target_text}</div>
                            <div data-testid="history-created-at" className="hint mono" style={{ fontSize: 11 }}>{r.created_at}</div>
                        </div>
                    ))}
                </div>
            )}

            {total === 0 && (
                <div data-testid="history-empty" className="card" style={{ padding: 14, textAlign: 'center', opacity: disabled ? 0.5 : 1 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-mute)' }}>暂无历史记录</p>
                </div>
            )}

            {/* Pagination */}
            {total > 0 && (
                <div className="between">
                    <div data-testid="history-count" className="hint mono">共 {total} 条</div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button data-testid="history-prev" className="btn ghost icon sm" disabled={page <= 1 || disabled} onClick={() => { setPage(page - 1); }}>
                            <Icons.Chev size={12} style={{ transform: 'rotate(90deg)' }} />
                        </button>
                        <span data-testid="history-page" className="hint mono" style={{ padding: '0 8px' }}>{page} / {total_pages}</span>
                        <button data-testid="history-next" className="btn ghost icon sm" disabled={page >= total_pages || disabled} onClick={() => { setPage(page + 1); }}>
                            <Icons.Chev size={12} style={{ transform: 'rotate(-90deg)' }} />
                        </button>
                    </div>
                </div>
            )}

            {/* Edit modal */}
            {selected && (
                <div
                    data-testid="history-edit-modal"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                    }}
                    onClick={() => { setSelected(null); }}
                >
                    <div
                        className="card"
                        style={{ width: 480, padding: 0 }}
                        onClick={(e) => { e.stopPropagation(); }}
                    >
                        <div className="card-head">
                            <span>{selected.service_key}</span>
                            <button data-testid="history-edit-close" className="ic-btn" style={{ marginLeft: 'auto' }} onClick={() => { setSelected(null); }}>
                                <Icons.Close size={13} />
                            </button>
                        </div>
                        <div className="card-body">
                            <div>
                                <label style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 4, display: 'block' }}>源文本</label>
                                <div className="field" style={{ width: '100%' }}>
                                    <input data-testid="history-edit-source" value={editSource} onChange={(e) => { setEditSource(e.target.value); }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 4, display: 'block' }}>译文</label>
                                <div className="field" style={{ width: '100%' }}>
                                    <input data-testid="history-edit-target" value={editTarget} onChange={(e) => { setEditTarget(e.target.value); }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button data-testid="history-edit-cancel" className="btn ghost" onClick={() => { setSelected(null); }}>{t('ui.cancel', { defaultValue: '取消' })}</button>
                                <button data-testid="history-edit-save" className="btn primary" onClick={() => { handle_save().catch(console.error); }}>{t('ui.save', { defaultValue: '保存' })}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
