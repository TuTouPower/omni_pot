import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'
import { useConfig } from '../../hooks/use_config'
import { ConfigCard, ConfigRow, ConfigSelect, ConfigField } from './config_components'

const BACKUP_TYPES = [
    { value: 'webdav', label: 'WebDAV' },
    { value: 'local', label: '本地文件' },
]

function error_message(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

export default function BackupSettings(): React.ReactElement {
    const { t } = useTranslation()
    const [backupType, setBackupType] = useConfig('backup_type')
    const [webdavUrl, setWebdavUrl] = useConfig('webdav_url')
    const [webdavUsername, setWebdavUsername] = useConfig('webdav_username')
    const [webdavPassword, setWebdavPassword] = useConfig('webdav_password')

    const [backups, setBackups] = useState<string[]>([])
    const [status, setStatus] = useState('')
    const [restoreModal, setRestoreModal] = useState(false)

    const load_backups = useCallback(async () => {
        try {
            const list = await window.electronAPI.backup.list()
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

    return (
        <div className="stack gap-12">
            <ConfigCard title={t('backup.title') || '备份'}>
                <ConfigRow label="备份类型">
                    <ConfigSelect
                        value={backupType}
                        onChange={setBackupType}
                        options={BACKUP_TYPES}
                        testId="cfg-backup_type"
                        style={{ minWidth: 160 }}
                    />
                </ConfigRow>
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
                            style={{ minWidth: 280 }}
                        />
                    </ConfigRow>
                </ConfigCard>
            )}

            <ConfigCard title="操作">
                <div style={{ display: 'flex', gap: 8 }}>
                    <button data-testid="backup-create" className="btn primary" onClick={() => { handle_backup().catch(console.error); }}>
                        <Icons.Cloud size={14} />
                        {t('backup.create') || '立即备份'}
                    </button>
                    <button data-testid="backup-restore-open" className="btn" onClick={() => { load_backups().catch(console.error); setRestoreModal(true) }}>
                        <Icons.Cycle size={14} />
                        {t('backup.restore') || '从备份恢复'}
                    </button>
                </div>
                {status && <p data-testid="backup-status" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{status}</p>}
                <div data-testid="backup-content-hint" className="hint">备份内容：配置、历史记录数据库、CC-CEDICT 词典数据库</div>
            </ConfigCard>

            {/* Recent backups */}
            <ConfigCard title="最近备份">
                {backups.length === 0 && (
                    <p data-testid="backup-empty" style={{ fontSize: 13, color: 'var(--text-mute)' }}>{t('backup.no_backups') || '暂无备份'}</p>
                )}
                {backups.slice(0, 5).map((name, i) => (
                    <div key={name} data-testid="backup-row" data-backup-name={name} className="row" style={{ paddingBottom: 8, borderBottom: i < Math.min(backups.length, 5) - 1 ? '1px solid var(--line)' : 'none' }}>
                        <Icons.Cloud size={14} style={{ color: 'var(--text-mute)' }} />
                        <div style={{ flex: 1 }}>
                            <div className="mono" style={{ fontSize: 12 }}>{name}</div>
                        </div>
                    </div>
                ))}
            </ConfigCard>

            {/* Restore modal */}
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
                            {backups.map((name) => (
                                <div
                                    key={name}
                                    data-testid="backup-restore-row"
                                    data-backup-name={name}
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
                                    <span style={{ fontSize: 13 }}>{name}</span>
                                    <button data-testid="backup-restore-action" className="btn sm primary" onClick={() => { handle_restore(name).catch(console.error); }}>恢复</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
