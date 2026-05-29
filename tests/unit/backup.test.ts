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
    reload_config_from_disk: vi.fn(),
    broadcastAllConfig: vi.fn(),
    close_history: vi.fn(),
}))

vi.mock('../../electron/config/store', () => ({
    cancel_pending_config_save: mocks.cancel_pending_config_save,
    flush_config: mocks.flush_config,
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

    it('restores config and history from a local backup zip', () => {
        writeFileSync(join(mocks.user_data_dir, 'config.json'), '{"app_language":"en"}')
        writeFileSync(join(mocks.user_data_dir, 'history.db'), 'history')
        const backup_path = create_local_backup()

        writeFileSync(join(mocks.user_data_dir, 'config.json'), '{"app_language":"zh_cn"}')
        writeFileSync(join(mocks.user_data_dir, 'history.db'), 'changed')
        writeFileSync(join(mocks.user_data_dir, 'history.db-shm'), 'stale shm')

        const result = restore_from_zip_path(backup_path)

        expect(readFileSync(join(mocks.user_data_dir, 'config.json'), 'utf-8')).toBe('{"app_language":"en"}')
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
