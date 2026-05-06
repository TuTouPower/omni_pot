import React from 'react'
import { Button, Card, Input, Label, ListBox, Select } from '@heroui/react'
import { useConfig } from '../../hooks/use_config'

const BACKUP_TYPES = [
    { key: 'webdav', label: 'WebDAV' },
    { key: 'aliyun', label: 'Aliyun OSS' },
    { key: 'local', label: 'Local' }
]

export default function BackupSettings(): React.ReactElement {
    const [backupType, setBackupType] = useConfig('backup_type')
    const [webdavUrl, setWebdavUrl] = useConfig('webdav_url')
    const [webdavUsername, setWebdavUsername] = useConfig('webdav_username')
    const [webdavPassword, setWebdavPassword] = useConfig('webdav_password')

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold">Backup</h3>

            <Card>
                <Card.Content className="gap-3 p-4">
                    <h4 className="font-semibold">Backup Type</h4>
                    <Select
                        className="w-full"
                        value={backupType}
                        onChange={(v) => { if (v != null) setBackupType(String(v)) }}
                    >
                        <Label>Type</Label>
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {BACKUP_TYPES.map((opt) => (
                                    <ListBox.Item key={opt.key} id={opt.key} textValue={opt.label}>
                                        {opt.label}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
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
                    <p className="text-sm text-default-500">
                        Backup and restore features coming soon.
                    </p>
                    <Button isDisabled color="primary">
                        Backup (Coming Soon)
                    </Button>
                    <Button isDisabled color="secondary">
                        Restore (Coming Soon)
                    </Button>
                </Card.Content>
            </Card>
        </div>
    )
}
