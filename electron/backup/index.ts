import { app } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { execSync } from 'child_process'
import { getConfig } from '../config/store'

function get_config_path(): string {
    return join(app.getPath('userData'), 'config.json')
}

function get_history_path(): string {
    return join(app.getPath('userData'), 'history.db')
}

function get_backup_dir(): string {
    const dir = join(app.getPath('userData'), 'backups')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
}

function create_zip(files: { name: string; data: Buffer }[], out_path: string): void {
    // Use Node.js built-in or a minimal approach - create a simple zip via archiver pattern
    // For now, use tar as fallback or write raw zip
    // Using the JSZip-compatible approach: write files as a simple archive
    const { execFileSync } = require('child_process')

    const tmp_dir = join(app.getPath('userData'), '_backup_tmp')
    if (existsSync(tmp_dir)) {
        for (const f of readdirSync(tmp_dir)) unlinkSync(join(tmp_dir, f))
    } else {
        mkdirSync(tmp_dir, { recursive: true })
    }

    for (const { name, data } of files) {
        writeFileSync(join(tmp_dir, name), data)
    }

    try {
        execFileSync('python3', ['-c', `
import zipfile, os
with zipfile.ZipFile('${out_path}', 'w', zipfile.ZIP_STORED) as z:
    for f in os.listdir('${tmp_dir}'):
        z.write(os.path.join('${tmp_dir}', f), f)
`])
    } finally {
        for (const f of readdirSync(tmp_dir)) unlinkSync(join(tmp_dir, f))
    }
}

export function create_local_backup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backup_name = `pot-backup-${timestamp}.zip`
    const backup_path = join(get_backup_dir(), backup_name)

    const files: { name: string; data: Buffer }[] = []

    const config_path = get_config_path()
    if (existsSync(config_path)) {
        files.push({ name: 'config.json', data: readFileSync(config_path) })
    }

    const history_path = get_history_path()
    if (existsSync(history_path)) {
        files.push({ name: 'history.db', data: readFileSync(history_path) })
    }

    create_zip(files, backup_path)
    return backup_path
}

export function list_local_backups(): string[] {
    const dir = get_backup_dir()
    if (!existsSync(dir)) return []
    return readdirSync(dir)
        .filter((f) => f.endsWith('.zip'))
        .sort()
        .reverse()
}

export function restore_local_backup(backup_name: string): void {
    const backup_path = join(get_backup_dir(), backup_name)
    if (!existsSync(backup_path)) throw new Error(`Backup not found: ${backup_name}`)

    // Extract using python
    const tmp_dir = join(app.getPath('userData'), '_restore_tmp')
    if (!existsSync(tmp_dir)) mkdirSync(tmp_dir, { recursive: true })

    const { execFileSync } = require('child_process')
    execFileSync('python3', ['-c', `
import zipfile
with zipfile.ZipFile('${backup_path}', 'r') as z:
    z.extractall('${tmp_dir}')
`])

    // Restore config
    const config_src = join(tmp_dir, 'config.json')
    if (existsSync(config_src)) {
        writeFileSync(get_config_path(), readFileSync(config_src))
    }

    // Restore history
    const history_src = join(tmp_dir, 'history.db')
    if (existsSync(history_src)) {
        writeFileSync(get_history_path(), readFileSync(history_src))
    }

    // Cleanup
    for (const f of readdirSync(tmp_dir)) unlinkSync(join(tmp_dir, f))
}
