import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Label, Modal, Switch, TextField } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'
import type { HistoryRecord } from '@shared/types/ipc'

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
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">{t('history.title')}</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <Switch isSelected={historyDisable} onChange={setHistoryDisable}>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label className="text-sm">{t('history.disable')}</Label>
                        </Switch.Content>
                    </Switch>
                </Card.Content>
            </Card>

            {records.length > 0 && (
                <Card>
                    <Card.Content className="gap-2 p-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-default-500">{total} records</span>
                            <Button color="danger" size="sm" onPress={handle_clear}>
                                {t('history.clear')}
                            </Button>
                        </div>

                        <div className="flex flex-col gap-1">
                            {records.map((r) => (
                                <div
                                    key={r.id}
                                    className="flex items-center gap-2 p-2 rounded hover:bg-default-100 cursor-pointer text-sm"
                                    onClick={() => handle_select(r)}
                                >
                                    <span className="w-20 truncate text-default-400">{r.service_key}</span>
                                    <span className="flex-1 truncate">{r.source_text}</span>
                                    <span className="flex-1 truncate text-default-500">{r.target_text}</span>
                                    <span className="text-xs text-default-400 whitespace-nowrap">{r.created_at}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-center gap-2 mt-2">
                            <Button size="sm" isDisabled={page <= 1} onPress={() => setPage(page - 1)}>
                                {t('ui.prev')}
                            </Button>
                            <span className="text-sm self-center">{page} / {total_pages}</span>
                            <Button size="sm" isDisabled={page >= total_pages} onPress={() => setPage(page + 1)}>
                                {t('ui.next')}
                            </Button>
                        </div>
                    </Card.Content>
                </Card>
            )}

            {total === 0 && (
                <Card>
                    <Card.Content className="p-4">
                        <p className="text-sm text-default-500">No history records yet.</p>
                    </Card.Content>
                </Card>
            )}

            <Modal isOpen={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
                <Modal.Content>
                    <Modal.Header>
                        <h4 className="font-semibold">{selected?.service_key}</h4>
                    </Modal.Header>
                    <Modal.Body className="gap-3">
                        <TextField value={editSource} onChange={setEditSource}>
                            <Label>Source</Label>
                            <TextField.Input />
                        </TextField>
                        <TextField value={editTarget} onChange={setEditTarget}>
                            <Label>Result</Label>
                            <TextField.Input />
                        </TextField>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="ghost" onPress={() => setSelected(null)}>{t('ui.cancel')}</Button>
                        <Button color="primary" onPress={handle_save}>{t('ui.save')}</Button>
                    </Modal.Footer>
                </Modal.Content>
            </Modal>
        </div>
    )
}
