import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { basename, join } from 'path'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import {
    create_local_backup,
    list_local_backups,
    list_local_backups_with_size,
    restore_from_zip_path,
    restore_local_backup,
} from '../../electron/backup'

const mocks = vi.hoisted(() => ({
    user_data_dir: '',
    cancel_pending_config_save: vi.fn(),
    flush_config: vi.fn(),
    getAllConfig: vi.fn(() => ({ app_language: 'en' })),
    reload_config_from_disk: vi.fn(),
    broadcastAllConfig: vi.fn(),
    close_history: vi.fn(),
}))

vi.mock('electron', () => ({
    safeStorage: {
        isEncryptionAvailable: vi.fn(() => true),
        encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`, 'utf-8')),
        decryptString: vi.fn((value: Buffer) => value.toString('utf-8').replace(/^encrypted:/, '')),
    },
}))

vi.mock('../../electron/config/store', () => ({
    cancel_pending_config_save: mocks.cancel_pending_config_save,
    flush_config: mocks.flush_config,
    getAllConfig: mocks.getAllConfig,
    getUserDataDir: () => mocks.user_data_dir,
    reload_config_from_disk: mocks.reload_config_from_disk,
    broadcastAllConfig: mocks.broadcastAllConfig,
}))

vi.mock('../../electron/history', () => ({
    close_history: mocks.close_history,
}))

describe('local backup', () => {
    beforeEach(() => {
        mocks.user_data_dir = mkdtempSync(join(tmpdir(), 'omni-backup-test-'))
        vi.clearAllMocks()
        mocks.getAllConfig.mockReturnValue({ app_language: 'en' })
    })

    afterEach(() => {
        rmSync(mocks.user_data_dir, { recursive: true, force: true })
    })

    it('creates and lists local backup zips', () => {
        writeFileSync(join(mocks.user_data_dir, 'config.json'), '{"app_language":"en"}')
        writeFileSync(join(mocks.user_data_dir, 'history.db'), 'history')

        const backup_path = create_local_backup()
        const backup_name = basename(backup_path)

        expect(existsSync(backup_path)).toBe(true)
        expect(list_local_backups()).toEqual([backup_name])
        const backup_entries = list_local_backups_with_size()
        expect(backup_entries).toHaveLength(1)
        expect(backup_entries[0]?.name).toBe(backup_name)
        expect(backup_entries[0]?.size).toBeGreaterThan(0)
        expect(mocks.flush_config).toHaveBeenCalledOnce()
        expect(mocks.close_history).toHaveBeenCalledOnce()
    })

    it('omits credentials from backup config', () => {
        mocks.getAllConfig.mockReturnValue({
            app_language: 'en',
            server_api_token: 'server-token-secret',
            webdav_password: 'webdav-password-secret',
            service_instances: {
                'custom@default': {
                    serviceKey: 'custom',
                    config: {
                        api_key: 'provider-key-secret',
                        endpoint: 'https://example.test',
                    },
                },
            },
        })
        writeFileSync(join(mocks.user_data_dir, 'config.json'), '{"server_api_token":"server-token-secret"}')

        const backup_path = create_local_backup()
        const backup_text = readFileSync(backup_path).toString('utf-8')

        expect(backup_text).not.toContain('server-token-secret')
        expect(backup_text).not.toContain('webdav-password-secret')
        expect(backup_text).not.toContain('provider-key-secret')
        expect(backup_text).toContain('https://example.test')
    })

    it('restores config and history from a local backup zip', () => {
        writeFileSync(join(mocks.user_data_dir, 'config.json'), '{"app_language":"en"}')
        writeFileSync(join(mocks.user_data_dir, 'history.db'), 'history')
        const backup_path = create_local_backup()

        writeFileSync(join(mocks.user_data_dir, 'config.json'), '{"app_language":"zh_cn"}')
        writeFileSync(join(mocks.user_data_dir, 'history.db'), 'changed')
        writeFileSync(join(mocks.user_data_dir, 'history.db-shm'), 'stale shm')

        const result = restore_from_zip_path(backup_path)

        const restored_config = JSON.parse(readFileSync(join(mocks.user_data_dir, 'config.json'), 'utf-8')) as Record<string, unknown>
        expect(restored_config.app_language).toBe('en')
        expect(readFileSync(join(mocks.user_data_dir, 'history.db'), 'utf-8')).toBe('history')
        expect(existsSync(join(mocks.user_data_dir, 'history.db-shm'))).toBe(false)
        expect(result.restored_files).toEqual(['config.json', 'history.db'])
        expect(mocks.cancel_pending_config_save).toHaveBeenCalledOnce()
        expect(mocks.reload_config_from_disk).toHaveBeenCalledOnce()
        expect(mocks.broadcastAllConfig).toHaveBeenCalledOnce()
    })

    it('rejects backup path traversal', () => {
        expect(() => {
            restore_local_backup('../backup.zip')
        }).toThrow('Invalid backup name')
    })
})
