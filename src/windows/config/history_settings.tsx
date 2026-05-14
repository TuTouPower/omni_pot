import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfig } from '../../hooks/use_config'
import type { HistoryRecord } from '@shared/types/ipc'
import { ConfigCard, ConfigRow, ConfigSwitch } from './config_components'

const PAGE_SIZE = 20

export default function HistorySettings(): React.ReactElement {
    const { t } = useTranslation()
    const [historyDisable, setHistoryDisable] = useConfig('history_disable')
    const [records, setRecords] = useState<HistoryRecord[]>([])
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [selected, setSelected] = useState<HistoryRecord | null>(null)
    const [editSource, setEditSource] = useState('')
    const [editTarget, setEditTarget] = useState('')

    const load_page = useCallback(async (p: number) => {
        const api = window.electronAPI
        const count = await api.history.count()
        setTotal(count)
        const rows = await api.history.list(p, PAGE_SIZE)
        setRecords(rows)
    }, [])

    useEffect(() => { load_page(page) }, [page, load_page])

    const total_pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const handle_clear = async (): Promise<void> => {
        await window.electronAPI.history.clear()
        setPage(1)
        load_page(1)
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
        load_page(page)
    }

    return (
        <div className="stack gap-12">
            <ConfigCard title={t('history.title') || '历史记录'}>
                <ConfigRow label={t('history.disable') || '禁用历史记录'}>
                    <ConfigSwitch on={historyDisable} onChange={setHistoryDisable} />
                </ConfigRow>
            </ConfigCard>

            {/* Search + controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn sm danger" onClick={handle_clear}>
                    <Icons.Trash size={12} />
                    {t('history.clear') || '清空'}
                </button>
            </div>

            {/* Records table */}
            {records.length > 0 && (
                <div className="card" style={{ padding: 0 }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 120px 1fr 120px',
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
                        <div>服务</div>
                        <div>译文</div>
                        <div>时间</div>
                    </div>
                    {records.map((r, i) => (
                        <div
                            key={r.id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 120px 1fr 120px',
                                alignItems: 'center',
                                padding: '10px 14px',
                                borderBottom: i < records.length - 1 ? '1px solid var(--line)' : 'none',
                                cursor: 'pointer',
                                transition: 'background .12s',
                                gap: 12,
                            }}
                            onClick={() => handle_select(r)}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{r.source_text}</div>
                            <div className="hint mono" style={{ fontSize: 11 }}>{r.service_key}</div>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-dim)' }}>{r.target_text}</div>
                            <div className="hint mono" style={{ fontSize: 11 }}>{r.created_at}</div>
                        </div>
                    ))}
                </div>
            )}

            {total === 0 && (
                <div className="card" style={{ padding: 14, textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-mute)' }}>暂无历史记录</p>
                </div>
            )}

            {/* Pagination */}
            {total > 0 && (
                <div className="between">
                    <div className="hint mono">共 {total} 条</div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button className="btn ghost icon sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                            <Icons.Chev size={12} style={{ transform: 'rotate(90deg)' }} />
                        </button>
                        <span className="hint mono" style={{ padding: '0 8px' }}>{page} / {total_pages}</span>
                        <button className="btn ghost icon sm" disabled={page >= total_pages} onClick={() => setPage(page + 1)}>
                            <Icons.Chev size={12} style={{ transform: 'rotate(-90deg)' }} />
                        </button>
                    </div>
                </div>
            )}

            {/* Edit modal */}
            {selected && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                    }}
                    onClick={() => setSelected(null)}
                >
                    <div
                        className="card"
                        style={{ width: 480, padding: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="card-head">
                            <span>{selected.service_key}</span>
                            <button className="ic-btn" style={{ marginLeft: 'auto' }} onClick={() => setSelected(null)}>
                                <Icons.Close size={13} />
                            </button>
                        </div>
                        <div className="card-body">
                            <div>
                                <label style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 4, display: 'block' }}>源文本</label>
                                <div className="field" style={{ width: '100%' }}>
                                    <input value={editSource} onChange={(e) => setEditSource(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 4, display: 'block' }}>译文</label>
                                <div className="field" style={{ width: '100%' }}>
                                    <input value={editTarget} onChange={(e) => setEditTarget(e.target.value)} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="btn ghost" onClick={() => setSelected(null)}>{t('ui.cancel') || '取消'}</button>
                                <button className="btn primary" onClick={handle_save}>{t('ui.save') || '保存'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
