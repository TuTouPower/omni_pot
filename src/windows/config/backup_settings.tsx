import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfig } from '../../hooks/use_config'
import { ConfigCard, ConfigRow, ConfigField } from './config_components'

interface BackupEntry {
    name: string
    size: number
}

function error_message(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

function format_size(bytes: number): string {
    if (bytes < 1024) return `${String(bytes)} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extract_timestamp(name: string): string {
    const m = name.match(/pot-backup-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/)
    if (!m) return ''
    const [, year = '', month = '', day = '', hour = '', minute = ''] = m
    return `${year}-${month}-${day} ${hour}:${minute}`
}

const BACKUP_TYPES = [
    { value: 'webdav' as const, label: 'WebDAV', sub: '同步到任意 WebDAV 服务器' },
    { value: 'local' as const, label: '本地文件', sub: '导出 ZIP 到本地路径' },
]

export default function BackupSettings(): React.ReactElement {
    const { t } = useTranslation()
    const [backupType, setBackupType] = useConfig('backup_type')
    const [webdavUrl, setWebdavUrl] = useConfig('webdav_url')
    const [webdavUsername, setWebdavUsername] = useConfig('webdav_username')
    const [webdavPassword, setWebdavPassword] = useConfig('webdav_password')

    const [backups, setBackups] = useState<BackupEntry[]>([])
    const [status, setStatus] = useState('')
    const [restoreModal, setRestoreModal] = useState(false)

    const load_backups = useCallback(async () => {
        try {
            const list = await window.electronAPI.backup.listWithSize()
            setBackups(list)
        } catch (error) {
            setStatus(`Error: ${error_message(error)}`)
        }
    }, [])

    useEffect(() => { load_backups().catch(console.error) }, [load_backups])

    const handle_backup = async (): Promise<void> => {
        setStatus('Creating backup...')
        try {
            const result = await window.electronAPI.backup.create()
            if (result.success) {
                setStatus(`Backup created: ${result.path ?? ''}`)
                load_backups().catch(console.error)
            } else {
                setStatus(`Error: ${result.error ?? ''}`)
            }
        } catch (error) {
            setStatus(`Error: ${error_message(error)}`)
        }
    }

    const handle_restore = async (name: string): Promise<void> => {
        setStatus('Restoring...')
        try {
            const result = await window.electronAPI.backup.restore(name)
            if (result.success) {
                setStatus('Restored successfully. Please restart the app.')
                setRestoreModal(false)
            } else {
                setStatus(`Error: ${result.error ?? ''}`)
            }
        } catch (error) {
            setStatus(`Error: ${error_message(error)}`)
        }
    }

    const handle_delete = async (name: string): Promise<void> => {
        try {
            const result = await window.electronAPI.backup.delete(name)
            if (result.success) {
                load_backups().catch(console.error)
            } else {
                setStatus(`删除失败: ${result.error ?? ''}`)
            }
        } catch (error) {
            setStatus(`删除失败: ${error_message(error)}`)
        }
    }

    const handle_copy_path = async (name: string): Promise<void> => {
        try {
            const path = await window.electronAPI.backup.getPath(name)
            await navigator.clipboard.writeText(path)
        } catch (error) {
            setStatus(`复制失败: ${error_message(error)}`)
        }
    }

    return (
        <div className="stack gap-12">
            <ConfigCard title="备份目标">
                <div style={{ display: 'flex', gap: 8 }}>
                    {BACKUP_TYPES.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            data-testid={`cfg-backup_type-${opt.value}`}
                            onClick={() => { setBackupType(opt.value); }}
                            style={{
                                flex: 1,
                                padding: 12,
                                borderRadius: 10,
                                border: `1px solid ${backupType === opt.value ? 'var(--brand-primary)' : 'var(--line)'}`,
                                background: backupType === opt.value ? 'var(--brand-primary-soft)' : 'var(--bg-elev)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                            }}
                        >
                            <div style={{ fontSize: 13, fontWeight: 600, color: backupType === opt.value ? 'var(--brand-primary)' : 'var(--text)' }}>{opt.label}</div>
                            <div className="hint" style={{ marginTop: 2 }}>{opt.sub}</div>
                        </button>
                    ))}
                </div>
            </ConfigCard>

            {backupType === 'webdav' && (
                <ConfigCard title="WebDAV 连接">
                    <ConfigRow label="服务器地址">
                        <ConfigField
                            placeholder="https://dav.example.com/dav"
                            value={webdavUrl}
                            onChange={setWebdavUrl}
                            testId="cfg-webdav_url"
                            style={{ minWidth: 280 }}
                        />
                    </ConfigRow>
                    <ConfigRow label="用户名">
                        <ConfigField
                            value={webdavUsername}
                            onChange={setWebdavUsername}
                            testId="cfg-webdav_username"
                            style={{ minWidth: 280 }}
                        />
                    </ConfigRow>
                    <ConfigRow label="密码">
                        <ConfigField
                            value={webdavPassword}
                            onChange={setWebdavPassword}
                            testId="cfg-webdav_password"
                            type="password"
                            style={{ minWidth: 280 }}
                        />
                    </ConfigRow>
                    <div className="row" style={{ marginTop: 4 }}>
                        <div style={{ flex: 1 }} />
                        <button data-testid="backup-test-connection" className="btn sm" onClick={() => { setStatus('WebDAV 同步功能即将推出'); }}>
                            测试连接
                        </button>
                    </div>
                </ConfigCard>
            )}

            {backupType === 'local' && (
                <ConfigCard title="本地路径">
                    <ConfigRow label="备份目录">
                        <div className="mono hint" style={{ fontSize: 12 }}>~/Documents/OmniPotBackups</div>
                    </ConfigRow>
                </ConfigCard>
            )}

            <ConfigCard title="操作">
                <div style={{ display: 'flex', gap: 8 }}>
                    <button data-testid="backup-create" className="btn primary" onClick={() => { handle_backup().catch(console.error); }}>
                        <Icons.Cloud size={14} />
                        {t('backup.create', { defaultValue: '立即备份' })}
                    </button>
                    <button data-testid="backup-restore-open" className="btn" onClick={() => { load_backups().catch(console.error); setRestoreModal(true) }}>
                        <Icons.Cycle size={14} />
                        {t('backup.restore', { defaultValue: '从备份恢复' })}
                    </button>
                </div>
                {status && <p data-testid="backup-status" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{status}</p>}
                <div data-testid="backup-content-hint" className="hint">备份内容：设置、历史记录数据库</div>
            </ConfigCard>

            <ConfigCard title="最近备份">
                {backups.length === 0 && (
                    <p data-testid="backup-empty" style={{ fontSize: 13, color: 'var(--text-mute)' }}>{t('backup.no_backups', { defaultValue: '暂无备份' })}</p>
                )}
                {backups.slice(0, 5).map((entry, i) => (
                    <div key={entry.name} data-testid="backup-row" data-backup-name={entry.name} className="row" style={{ paddingBottom: 8, borderBottom: i < Math.min(backups.length, 5) - 1 ? '1px solid var(--line)' : 'none' }}>
                        <Icons.Cloud size={14} style={{ color: 'var(--text-mute)' }} />
                        <div style={{ flex: 1 }}>
                            <div className="mono" style={{ fontSize: 12 }}>{entry.name}</div>
                            <div className="hint" style={{ marginTop: 2 }}>
                                {extract_timestamp(entry.name)}{extract_timestamp(entry.name) ? ' · ' : ''}{format_size(entry.size)}
                            </div>
                        </div>
                        <button data-testid="backup-copy-path" className="btn ghost icon sm" title="复制路径" onClick={() => { handle_copy_path(entry.name).catch(console.error); }}>
                            <Icons.Copy size={12} />
                        </button>
                        <button data-testid="backup-delete" className="btn ghost icon sm" style={{ color: 'var(--danger)' }} title="删除" onClick={() => { handle_delete(entry.name).catch(console.error); }}>
                            <Icons.Trash size={12} />
                        </button>
                    </div>
                ))}
            </ConfigCard>

            {restoreModal && (
                <div
                    data-testid="backup-restore-modal"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                    }}
                    onClick={() => { setRestoreModal(false); }}
                >
                    <div
                        className="card"
                        style={{ width: 400, maxHeight: 400, overflow: 'auto', padding: 0 }}
                        onClick={(e) => { e.stopPropagation(); }}
                    >
                        <div className="card-head">
                            <span>恢复备份</span>
                            <button data-testid="backup-restore-close" className="ic-btn" style={{ marginLeft: 'auto' }} onClick={() => { setRestoreModal(false); }}>
                                <Icons.Close size={13} />
                            </button>
                        </div>
                        <div style={{ padding: 4 }}>
                            {backups.length === 0 && (
                                <p data-testid="backup-restore-empty" style={{ fontSize: 13, color: 'var(--text-mute)', padding: 12 }}>No backups available.</p>
                            )}
                            {backups.map((entry) => (
                                <div
                                    key={entry.name}
                                    data-testid="backup-restore-row"
                                    data-backup-name={entry.name}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        transition: 'background .12s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sunk)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div>
                                        <span style={{ fontSize: 13 }}>{entry.name}</span>
                                        <div className="hint" style={{ marginTop: 2 }}>{extract_timestamp(entry.name)}{extract_timestamp(entry.name) ? ' · ' : ''}{format_size(entry.size)}</div>
                                    </div>
                                    <button data-testid="backup-restore-action" className="btn sm primary" onClick={() => { handle_restore(entry.name).catch(console.error); }}>恢复</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
