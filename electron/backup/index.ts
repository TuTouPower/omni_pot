import { basename, join, resolve, sep } from 'path'
import { randomUUID } from 'crypto'
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, lstatSync, renameSync, mkdtempSync, rmSync } from 'fs'
import { cancel_pending_config_save, flush_config, getUserDataDir, reload_config_from_disk } from '../config/store'
import { close_history } from '../history'
import { close_dict } from '../dict'

interface BackupFile {
    name: string
    data: Buffer
}

interface ZipEntry {
    name: string
    data: Buffer
}

const BACKUP_MANIFEST_NAME = 'omni_pot_backup.json'
const BACKUP_MANIFEST = { app: 'omni_pot', version: 1 }
const BACKUP_DATA_FILES = [
    'history.db',
    'history.db-wal',
    'cc_cedict.db',
    'cc_cedict.db-wal',
]
const BACKUP_CLEANUP_FILES = [
    ...BACKUP_DATA_FILES,
    'history.db-shm',
    'cc_cedict.db-shm',
]

const BACKUP_FILE_NAMES = [BACKUP_MANIFEST_NAME, 'config.json', ...BACKUP_DATA_FILES]
const MAX_ZIP_ENTRY_BYTES: Record<string, number> = {
    [BACKUP_MANIFEST_NAME]: 1024,
    'config.json': 5 * 1024 * 1024,
    'history.db': 512 * 1024 * 1024,
    'history.db-wal': 512 * 1024 * 1024,
    'cc_cedict.db': 512 * 1024 * 1024,
    'cc_cedict.db-wal': 512 * 1024 * 1024,
}
const MAX_BACKUP_ZIP_BYTES = Object.values(MAX_ZIP_ENTRY_BYTES).reduce((total, size) => total + size, 0) + 1024 * 1024
const ZIP_STORED = 0

function get_config_path(): string {
    return join(getUserDataDir(), 'config.json')
}

function get_user_data_file_path(name: string): string {
    return join(getUserDataDir(), name)
}

function get_backup_dir(): string {
    const dir = join(getUserDataDir(), 'backups')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
}

function add_file_if_exists(files: BackupFile[], name: string, path: string): void {
    if (existsSync(path)) {
        files.push({ name, data: readFileSync(path) })
    }
}

const CRC32_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let j = 0; j < 8; j += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    CRC32_TABLE[i] = c >>> 0
}

function crc32(data: Buffer): number {
    let crc = 0xffffffff
    for (const byte of data) {
        crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
    }
    return (crc ^ 0xffffffff) >>> 0
}

function assert_zip32_size(value: number): void {
    if (value > 0xffffffff) throw new Error('Backup file is too large')
}

function create_zip(files: BackupFile[], out_path: string): void {
    if (files.length > 0xffff) throw new Error('Backup has too many files')

    const local_parts: Buffer[] = []
    const central_parts: Buffer[] = []
    let offset = 0

    for (const { name, data } of files) {
        assert_zip32_size(data.length)
        const name_buffer = Buffer.from(name, 'utf-8')
        if (name_buffer.length > 0xffff) throw new Error('Backup entry name is too long')
        const checksum = crc32(data)

        const local_header = Buffer.alloc(30)
        local_header.writeUInt32LE(0x04034b50, 0)
        local_header.writeUInt16LE(10, 4)
        local_header.writeUInt16LE(0, 6)
        local_header.writeUInt16LE(ZIP_STORED, 8)
        local_header.writeUInt16LE(0, 10)
        local_header.writeUInt16LE(0, 12)
        local_header.writeUInt32LE(checksum, 14)
        local_header.writeUInt32LE(data.length, 18)
        local_header.writeUInt32LE(data.length, 22)
        local_header.writeUInt16LE(name_buffer.length, 26)
        local_header.writeUInt16LE(0, 28)

        local_parts.push(local_header, name_buffer, data)

        const central_header = Buffer.alloc(46)
        central_header.writeUInt32LE(0x02014b50, 0)
        central_header.writeUInt16LE(20, 4)
        central_header.writeUInt16LE(10, 6)
        central_header.writeUInt16LE(0, 8)
        central_header.writeUInt16LE(ZIP_STORED, 10)
        central_header.writeUInt16LE(0, 12)
        central_header.writeUInt16LE(0, 14)
        central_header.writeUInt32LE(checksum, 16)
        central_header.writeUInt32LE(data.length, 20)
        central_header.writeUInt32LE(data.length, 24)
        central_header.writeUInt16LE(name_buffer.length, 28)
        central_header.writeUInt16LE(0, 30)
        central_header.writeUInt16LE(0, 32)
        central_header.writeUInt16LE(0, 34)
        central_header.writeUInt16LE(0, 36)
        central_header.writeUInt32LE(0, 38)
        central_header.writeUInt32LE(offset, 42)
        central_parts.push(central_header, name_buffer)

        offset += local_header.length + name_buffer.length + data.length
        assert_zip32_size(offset)
    }

    const central_directory = Buffer.concat(central_parts)
    assert_zip32_size(central_directory.length)

    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(0, 4)
    end.writeUInt16LE(0, 6)
    end.writeUInt16LE(files.length, 8)
    end.writeUInt16LE(files.length, 10)
    end.writeUInt32LE(central_directory.length, 12)
    end.writeUInt32LE(offset, 16)
    end.writeUInt16LE(0, 20)

    writeFileSync(out_path, Buffer.concat([...local_parts, central_directory, end]))
}

function find_end_of_central_directory(data: Buffer): number {
    if (data.length < 22) throw new Error('Invalid backup zip')

    const min = Math.max(0, data.length - 0xffff - 22)
    for (let offset = data.length - 22; offset >= min; offset -= 1) {
        if (data.readUInt32LE(offset) === 0x06054b50) return offset
    }
    throw new Error('Invalid backup zip')
}

function assert_range(data: Buffer, offset: number, length: number): void {
    if (offset < 0 || length < 0 || offset + length > data.length) {
        throw new Error('Invalid backup zip')
    }
}

function read_zip_entries(path: string): ZipEntry[] {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid backup zip')
    if (stat.size > MAX_BACKUP_ZIP_BYTES) throw new Error('Backup file is too large')

    const data = readFileSync(path)
    const end_offset = find_end_of_central_directory(data)
    const entry_count = data.readUInt16LE(end_offset + 10)
    const central_size = data.readUInt32LE(end_offset + 12)
    const central_offset = data.readUInt32LE(end_offset + 16)
    assert_range(data, central_offset, central_size)

    const allowed = new Set(BACKUP_FILE_NAMES)
    const seen = new Set<string>()
    const entries: ZipEntry[] = []
    let offset = central_offset

    for (let i = 0; i < entry_count; i += 1) {
        assert_range(data, offset, 46)
        if (data.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid backup zip')

        const method = data.readUInt16LE(offset + 10)
        const expected_crc = data.readUInt32LE(offset + 16)
        const compressed_size = data.readUInt32LE(offset + 20)
        const uncompressed_size = data.readUInt32LE(offset + 24)
        const name_length = data.readUInt16LE(offset + 28)
        const extra_length = data.readUInt16LE(offset + 30)
        const comment_length = data.readUInt16LE(offset + 32)
        const local_offset = data.readUInt32LE(offset + 42)
        const name_offset = offset + 46
        assert_range(data, name_offset, name_length)

        const name = data.subarray(name_offset, name_offset + name_length).toString('utf-8')
        const next_offset = name_offset + name_length + extra_length + comment_length
        assert_range(data, name_offset + name_length, extra_length + comment_length)
        if (next_offset > central_offset + central_size) throw new Error('Invalid backup zip')
        offset = next_offset

        if (!allowed.has(name)) continue
        if (seen.has(name)) throw new Error(`Duplicate backup entry: ${name}`)
        seen.add(name)

        const max_size = MAX_ZIP_ENTRY_BYTES[name] ?? 0
        if (uncompressed_size > max_size || compressed_size > max_size) {
            throw new Error(`Backup entry is too large: ${name}`)
        }
        if (method !== ZIP_STORED) throw new Error(`Unsupported backup entry compression: ${name}`)

        assert_range(data, local_offset, 30)
        if (data.readUInt32LE(local_offset) !== 0x04034b50) throw new Error('Invalid backup zip')
        const local_name_length = data.readUInt16LE(local_offset + 26)
        const local_extra_length = data.readUInt16LE(local_offset + 28)
        const content_offset = local_offset + 30 + local_name_length + local_extra_length
        assert_range(data, content_offset, compressed_size)

        const entry_data = Buffer.from(data.subarray(content_offset, content_offset + compressed_size))
        if (entry_data.length !== uncompressed_size || crc32(entry_data) !== expected_crc) {
            throw new Error(`Invalid backup entry checksum: ${name}`)
        }
        entries.push({ name, data: entry_data })
    }

    return entries
}

function read_json_entry(name: string, data: Buffer): unknown {
    try {
        return JSON.parse(data.toString('utf-8')) as unknown
    } catch {
        throw new Error(`Invalid backup entry JSON: ${name}`)
    }
}

function is_plain_config(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const config = value as Record<string, unknown>
    return !(Object.prototype.hasOwnProperty.call(config, '__proto__')
        || Object.prototype.hasOwnProperty.call(config, 'constructor')
        || Object.prototype.hasOwnProperty.call(config, 'prototype'))
}

function validate_backup_config(data: Buffer): void {
    if (!is_plain_config(read_json_entry('config.json', data))) {
        throw new Error('Invalid backup config')
    }
}

function validate_backup_entries(entry_by_name: Map<string, Buffer>): void {
    const manifest_data = entry_by_name.get(BACKUP_MANIFEST_NAME)
    const config_data = entry_by_name.get('config.json')
    if (!manifest_data || !config_data) throw new Error('Invalid omni_pot backup')

    const manifest = read_json_entry(BACKUP_MANIFEST_NAME, manifest_data)
    if (!manifest || typeof manifest !== 'object'
        || (manifest as Record<string, unknown>).app !== BACKUP_MANIFEST.app
        || (manifest as Record<string, unknown>).version !== BACKUP_MANIFEST.version) {
        throw new Error('Invalid omni_pot backup')
    }

    validate_backup_config(config_data)
}

function create_restore_staging_dir(entry_by_name: Map<string, Buffer>): string {
    const staging_dir = mkdtempSync(join(getUserDataDir(), 'restore-'))
    try {
        writeFileSync(join(staging_dir, 'config.json'), entry_by_name.get('config.json') as Buffer)
        for (const name of BACKUP_DATA_FILES) {
            const data = entry_by_name.get(name)
            if (data) writeFileSync(join(staging_dir, name), data)
        }
    } catch (error) {
        rmSync(staging_dir, { recursive: true, force: true })
        throw error
    }
    return staging_dir
}

function rollback_restore(rollback_paths: Map<string, string>): void {
    for (const [target_path, rollback_path] of rollback_paths) {
        remove_file_if_exists(target_path)
        if (existsSync(rollback_path)) renameSync(rollback_path, target_path)
    }
}

function replace_from_staging(staging_dir: string, entry_by_name: Map<string, Buffer>): void {
    const rollback_paths = new Map<string, string>()
    const rollback_id = randomUUID()
    const target_paths = [
        ...BACKUP_CLEANUP_FILES.map((name) => get_user_data_file_path(name)),
        get_config_path(),
    ]

    try {
        for (const target_path of target_paths) {
            const rollback_path = `${target_path}.restore-old-${rollback_id}`
            if (existsSync(target_path)) renameSync(target_path, rollback_path)
            rollback_paths.set(target_path, rollback_path)
        }

        for (const name of BACKUP_DATA_FILES) {
            if (entry_by_name.has(name)) renameSync(join(staging_dir, name), get_user_data_file_path(name))
        }
        renameSync(join(staging_dir, 'config.json'), get_config_path())
        reload_config_from_disk()

        for (const rollback_path of rollback_paths.values()) remove_file_if_exists(rollback_path)
    } catch (error) {
        rollback_restore(rollback_paths)
        throw error
    }
}

function resolve_backup_path(backup_name: string): string {
    if (backup_name !== basename(backup_name) || !backup_name.endsWith('.zip')) {
        throw new Error('Invalid backup name')
    }

    const backup_dir = resolve(get_backup_dir())
    const backup_path = resolve(backup_dir, backup_name)
    if (!backup_path.startsWith(`${backup_dir}${sep}`)) {
        throw new Error('Invalid backup name')
    }
    return backup_path
}

function remove_file_if_exists(path: string): void {
    if (!existsSync(path)) return
    const stat = lstatSync(path)
    if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error('Invalid backup file path')
    unlinkSync(path)
}

export function create_local_backup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backup_name = `pot-backup-${timestamp}-${randomUUID().slice(0, 8)}.zip`
    const backup_path = join(get_backup_dir(), backup_name)

    flush_config()
    close_history()
    close_dict()

    const files: BackupFile[] = [{
        name: BACKUP_MANIFEST_NAME,
        data: Buffer.from(JSON.stringify(BACKUP_MANIFEST), 'utf-8'),
    }]
    add_file_if_exists(files, 'config.json', get_config_path())
    for (const name of BACKUP_DATA_FILES) {
        add_file_if_exists(files, name, get_user_data_file_path(name))
    }

    create_zip(files, backup_path)
    return backup_path
}

export function list_local_backups(): string[] {
    const dir = get_backup_dir()
    if (!existsSync(dir)) return []
    return readdirSync(dir)
        .filter((f) => f === basename(f) && f.endsWith('.zip'))
        .sort()
        .reverse()
}

export function restore_local_backup(backup_name: string): void {
    const backup_path = resolve_backup_path(backup_name)
    if (!existsSync(backup_path)) throw new Error(`Backup not found: ${backup_name}`)

    const entries = read_zip_entries(backup_path)
    const entry_by_name = new Map(entries.map((entry) => [entry.name, entry.data]))
    validate_backup_entries(entry_by_name)

    const staging_dir = create_restore_staging_dir(entry_by_name)
    try {
        cancel_pending_config_save()
        close_history()
        close_dict()
        replace_from_staging(staging_dir, entry_by_name)
    } finally {
        rmSync(staging_dir, { recursive: true, force: true })
    }
}
