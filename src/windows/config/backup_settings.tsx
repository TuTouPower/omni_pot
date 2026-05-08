import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Input, Label, Modal } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'
import { SimpleSelect } from '../../components/simple_select'

const BACKUP_TYPES = [
    { key: 'webdav', label: 'WebDAV' },
    { key: 'local', label: 'Local' }
]

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
        const list = await window.electronAPI.backup.list()
        setBackups(list)
    }, [])

    useEffect(() => { load_backups() }, [load_backups])

    const handle_backup = async (): Promise<void> => {
        setStatus('Creating backup...')
        const result = await window.electronAPI.backup.create()
        if (result.success) {
            setStatus(`Backup created: ${result.path}`)
            load_backups()
        } else {
            setStatus(`Error: ${result.error}`)
        }
    }

    const handle_restore = async (name: string): Promise<void> => {
        setStatus('Restoring...')
        const result = await window.electronAPI.backup.restore(name)
        if (result.success) {
            setStatus('Restored successfully. Please restart the app.')
            setRestoreModal(false)
        } else {
            setStatus(`Error: ${result.error}`)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">{t('backup.title')}</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Backup Type</h4>
                    <SimpleSelect label="Type" value={backupType as string} onChange={(v) => setBackupType(v)} options={BACKUP_TYPES} />
                </Card.Content>
            </Card>

            {backupType === 'webdav' && (
                <Card>
                    <Card.Content className="gap-3 p-4">
                        <h4 className="font-semibold">WebDAV</h4>
                        <Input
                            label="URL"
                            value={webdavUrl}
                            onChange={(e) => setWebdavUrl(e.target.value)}
                            placeholder="https://example.com/dav"
                        />
                        <Input
                            label="Username"
                            value={webdavUsername}
                            onChange={(e) => setWebdavUsername(e.target.value)}
                            placeholder="username"
                        />
                        <Input
                            label="Password"
                            type="password"
                            value={webdavPassword}
                            onChange={(e) => setWebdavPassword(e.target.value)}
                            placeholder="password"
                        />
                    </Card.Content>
                </Card>
            )}

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Local Backups</h4>
                    <div className="flex gap-2">
                        <Button color="primary" onPress={handle_backup}>
                            {t('backup.create')}
                        </Button>
                        <Button color="secondary" onPress={() => { load_backups(); setRestoreModal(true) }}>
                            {t('backup.restore')}
                        </Button>
                    </div>
                    {status && <p className="text-sm text-default-500">{status}</p>}
                    {backups.length === 0 && (
                        <p className="text-sm text-default-400">{t('backup.no_backups')}</p>
                    )}
                    {backups.slice(0, 5).map((name) => (
                        <div key={name} className="text-sm text-default-500">{name}</div>
                    ))}
                </Card.Content>
            </Card>

            <Modal isOpen={restoreModal} onOpenChange={setRestoreModal}>
                <Modal.Content>
                    <Modal.Header>
                        <h4 className="font-semibold">Restore Backup</h4>
                    </Modal.Header>
                    <Modal.Body className="gap-2">
                        {backups.length === 0 && (
                            <p className="text-sm text-default-500">No backups available.</p>
                        )}
                        {backups.map((name) => (
                            <div key={name} className="flex justify-between items-center p-2 rounded hover:bg-default-100">
                                <span className="text-sm">{name}</span>
                                <Button size="sm" color="primary" onPress={() => handle_restore(name)}>
                                    Restore
                                </Button>
                            </div>
                        ))}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="ghost" onPress={() => setRestoreModal(false)}>{t('ui.close')}</Button>
                    </Modal.Footer>
                </Modal.Content>
            </Modal>
        </div>
    )
}
