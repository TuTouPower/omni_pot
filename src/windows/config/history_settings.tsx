import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfig } from '../../hooks/use_config'
import type { HistoryRecord } from '@shared/types/ipc'
import { ConfigSwitch } from './config_components'

const PAGE_SIZE = 20

const TIME_FILTERS = [
    { value: 0, labelKey: 'history.all_time' },
    { value: 1, labelKey: 'history.today' },
    { value: 7, labelKey: 'history.this_week' },
    { value: 30, labelKey: 'history.this_month' },
] as const

const SVC_ABBR: Record<string, string> = {
    bing: 'BI', deepl: 'DL', google: 'GG', mymemory: 'MM',
    geminipro: 'GP', baidu: 'BD',
    tencent: 'TC', alibaba: 'AL', caiyun: 'CY', youdao: 'YD',
    sogai: 'SG', translatetranslate: 'TT', cambridge_dict: 'CD',
}

const LANG_LABEL: Record<string, string> = {
    auto: 'AUTO', zh_cn: 'ZH', zh_tw: 'TW', en: 'EN', ja: 'JA', ko: 'KO', fr: 'FR',
    de: 'DE', es: 'ES', ru: 'RU', it: 'IT', pt_pt: 'PT', pt_br: 'BR', vi: 'VI',
}

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
    const [serviceOptions, setServiceOptions] = useState<string[]>([])
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

    useEffect(() => {
        let cancelled = false
        load_page(page).then(() => {
            if (cancelled) return
        }).catch(console.error)
        return () => { cancelled = true }
    }, [page, load_page])

    useEffect(() => {
        window.electronAPI.history.service_keys()
            .then(setServiceOptions)
            .catch(console.error)
    }, [records])

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

    const page_numbers = (): (number | string)[] => {
        if (total_pages <= 7) return Array.from({ length: total_pages }, (_, i) => i + 1)
        const pages: (number | string)[] = [1]
        if (page > 3) pages.push('...')
        for (let i = Math.max(2, page - 1); i <= Math.min(total_pages - 1, page + 1); i++) {
            pages.push(i)
        }
        if (page < total_pages - 2) pages.push('...')
        pages.push(total_pages)
        return pages
    }

    return (
        <div className="stack gap-12">
            {/* Unified toolbar */}
            <div style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'nowrap',
                padding: '8px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--line)',
                borderRadius: 10,
            }}>
                <span style={{ fontSize: 12.5, color: !historyDisable ? 'var(--text)' : 'var(--text-dim)', fontWeight: 500, whiteSpace: 'nowrap' }}>{t('history.enable', { defaultValue: '启用' })}</span>
                <ConfigSwitch on={!historyDisable} onChange={(v) => { setHistoryDisable(!v); }} testId="cfg-history_disable" />
                <div style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 4px', flexShrink: 0 }} />
                <div className="field" style={{ flex: '1 1 120px', minWidth: 96, opacity: disabled ? 0.5 : 1 }}>
                    <Icons.Search size={13} style={{ color: 'var(--text-mute)', flexShrink: 0 }} />
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
                    style={{ fontSize: 12, opacity: disabled ? 0.5 : 1, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', flexShrink: 0 }}
                >
                    <option value="">{t('history.all_services', { defaultValue: '全部服务' })}</option>
                    {serviceOptions.map((service_key) => (
                        <option key={service_key} value={service_key}>{service_key}</option>
                    ))}
                </select>
                <select
                    data-testid="history-time-filter"
                    value={timeFilter}
                    onChange={(e) => { setTimeFilter(Number(e.target.value)); setPage(1); }}
                    disabled={disabled}
                    style={{ fontSize: 12, opacity: disabled ? 0.5 : 1, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', flexShrink: 0 }}
                >
                    {TIME_FILTERS.map((f) => (
                        <option key={f.value} value={f.value}>{t(f.labelKey)}</option>
                    ))}
                </select>
                <div style={{ flex: 1 }} />
                <button data-testid="history-clear" className="btn sm danger" onClick={() => { handle_clear().catch(console.error); }} disabled={disabled} style={{ opacity: disabled ? 0.5 : 1, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <Icons.Trash size={12} />
                    {t('history.clear', { defaultValue: '清空' })}
                </button>
            </div>

            {/* Records table */}
            {records.length > 0 && (
                <div data-testid="history-list" className="card" style={{ padding: 0, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : undefined }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '32px 1fr 90px 1fr 100px',
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
                        <div />
                        <div>{t('history.column_source', { defaultValue: '源文本' })}</div>
                        <div>{t('history.column_language', { defaultValue: '语言' })}</div>
                        <div>{t('history.column_target', { defaultValue: '译文' })}</div>
                        <div>{t('history.column_time', { defaultValue: '时间' })}</div>
                    </div>
                    {records.map((r, i) => (
                        <div
                            key={r.id}
                            data-testid="history-row"
                            data-history-id={r.id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '32px 1fr 90px 1fr 100px',
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
                            <div data-testid="history-service-tile" className="svc-tile" title={r.service_key}>
                                {SVC_ABBR[r.service_key] ?? r.service_key.slice(0, 2).toUpperCase()}
                            </div>
                            <div data-testid="history-source" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{r.source_text}</div>
                            <div data-testid="history-language" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span className="flag">{LANG_LABEL[r.source_lang] ?? r.source_lang.slice(0, 2).toUpperCase()}</span>
                                <Icons.Chev size={10} style={{ color: 'var(--text-mute)', transform: 'rotate(-90deg)' }} />
                                <span className="flag">{LANG_LABEL[r.target_lang] ?? r.target_lang.slice(0, 2).toUpperCase()}</span>
                            </div>
                            <div data-testid="history-target" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-dim)' }}>{r.target_text}</div>
                            <div data-testid="history-created-at" className="hint mono" style={{ fontSize: 11 }}>{r.created_at}</div>
                        </div>
                    ))}
                </div>
            )}

            {total === 0 && (
                <div data-testid="history-empty" className="card" style={{ padding: 14, textAlign: 'center', opacity: disabled ? 0.5 : 1 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-mute)' }}>{t('history.empty', { defaultValue: '暂无历史记录' })}</p>
                </div>
            )}

            {/* Pagination */}
            {total > 0 && (
                <div className="between">
                    <div data-testid="history-count" className="hint mono">
                        {t('history.showing', { defaultValue: '显示 {{start}} – {{end}} / 共 {{total}} 条', start: (page - 1) * PAGE_SIZE + 1, end: Math.min(page * PAGE_SIZE, total), total: total.toLocaleString() })}
                        <span data-testid="history-current-page" data-page={page} style={{ display: 'none' }}>{page}</span>
                        <span data-testid="history-total-pages" data-page={total_pages} style={{ display: 'none' }}>{total_pages}</span>
                        <span data-testid="history-page" style={{ display: 'none' }}>{page} / {total_pages}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button data-testid="history-prev" className="btn ghost icon sm" disabled={page <= 1 || disabled} onClick={() => { setPage(page - 1); }}>
                            <Icons.Chev size={12} style={{ transform: 'rotate(90deg)' }} />
                        </button>
                        {page_numbers().map((p, idx) => (
                            typeof p === 'string'
                                ? <span key={`ellipsis-${String(idx)}`} className="hint" style={{ padding: '0 4px' }}>…</span>
                                : (
                                    <button
                                        key={p}
                                        data-testid={`history-page-${String(p)}`}
                                        className={p === page ? 'btn sm' : 'btn ghost sm'}
                                        style={p === page ? { background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', borderColor: 'transparent' } : undefined}
                                        disabled={disabled}
                                        onClick={() => { setPage(p); }}
                                    >
                                        {p}
                                    </button>
                                )
                        ))}
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
                                <label style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 4, display: 'block' }}>{t('history.column_source', { defaultValue: '源文本' })}</label>
                                <div className="field" style={{ width: '100%' }}>
                                    <input data-testid="history-edit-source" value={editSource} onChange={(e) => { setEditSource(e.target.value); }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 4, display: 'block' }}>{t('history.column_target', { defaultValue: '译文' })}</label>
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
