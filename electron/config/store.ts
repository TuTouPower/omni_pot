import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { DEFAULT_CONFIG, DEFAULT_SERVICE_INSTANCES } from '@shared/types/config'
import type { AppConfig, ConfigKey } from '@shared/types/config'

interface PersistedShape extends Partial<AppConfig> {
    __initialized?: boolean
    service_instances?: typeof DEFAULT_SERVICE_INSTANCES
}

let config_path: string
let data: PersistedShape = {}

function to_persisted_shape(value: unknown): PersistedShape {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const config = value as Record<string, unknown>
    if (Object.prototype.hasOwnProperty.call(config, '__proto__')
        || Object.prototype.hasOwnProperty.call(config, 'constructor')
        || Object.prototype.hasOwnProperty.call(config, 'prototype')) return {}
    return config as PersistedShape
}

function read_config_from_disk(): PersistedShape {
    if (!existsSync(config_path)) return {}
    try {
        return to_persisted_shape(JSON.parse(readFileSync(config_path, 'utf-8')) as unknown)
    } catch {
        return {}
    }
}

/** Get the effective userData directory (respects E2E override). */
export function getUserDataDir(): string {
    return process.env['OMNI_POT_USER_DATA'] || app.getPath('userData')
}

/** Map Electron locale to our app language code and default target language. */
function resolveSystemLanguage(): string {
    const locale = (app.getLocale() ?? 'en').toLowerCase()
    if (locale.startsWith('zh')) return 'zh_cn'
    return 'en'
}

export function initConfigStore(): void {
    // Allow E2E tests to specify a custom userData directory
    const dir = getUserDataDir()
    config_path = join(dir, 'config.json')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    data = read_config_from_disk()

    // E2E: inject preset config from environment variable
    if (process.env['OMNI_POT_PRESET_CONFIG']) {
        try {
            const preset = JSON.parse(process.env['OMNI_POT_PRESET_CONFIG'])
            data = { ...data, ...preset }
        } catch { /* ignore bad JSON */ }
    }

    // E2E: force first-run state
    if (process.env['OMNI_POT_FIRST_RUN'] === '1') {
        data.__initialized = undefined
    }

    if (!data.__initialized) {
        const sysLang = resolveSystemLanguage()
        data = {
            ...data,
            app_language: data.app_language ?? sysLang,
            translate_target_language: data.translate_target_language ?? sysLang,
            service_instances: {
                ...DEFAULT_SERVICE_INSTANCES,
                ...(data.service_instances ?? {})
            }
        }
        saveToDisk()
    }

    // Migrate: clear stale DeepL config that pointed to official API with empty key
    const deeplInst = data.service_instances?.['deepl@default']
    if (deeplInst && (deeplInst.config as Record<string, unknown>)?.type === 'free'
        && !(deeplInst.config as Record<string, unknown>)?.authKey) {
        deeplInst.config = {}
        saveToDisk()
    }
}

export function isFirstRun(): boolean {
    return data.__initialized !== true
}

export function commitFirstRun(): void {
    data.__initialized = true
    saveToDisk()
}

export function getConfig(key: ConfigKey): unknown {
    // Allow environment variable overrides (used by E2E tests)
    if (key === 'server_port' && process.env['OMNI_POT_SERVER_PORT']) {
        return Number(process.env['OMNI_POT_SERVER_PORT'])
    }
    if (key === 'clipboard_monitor' && process.env['OMNI_POT_CLIPBOARD_MONITOR']) {
        return process.env['OMNI_POT_CLIPBOARD_MONITOR'] === 'true'
    }
    return key in data && data[key] !== undefined
        ? data[key]
        : DEFAULT_CONFIG[key]
}

export function setConfig(key: ConfigKey, value: unknown): void {
    ;(data as Record<string, unknown>)[key] = value
    saveToDisk()
    broadcastChange(key, value)
}

export function getAllConfig(): AppConfig {
    return { ...DEFAULT_CONFIG, ...data } as AppConfig
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function write_config_to_disk(): void {
    writeFileSync(config_path, JSON.stringify(data, null, 2), 'utf-8')
}

function cancel_pending_save(): void {
    if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
    }
}

export function flush_config(): void {
    cancel_pending_save()
    write_config_to_disk()
}

export function cancel_pending_config_save(): void {
    cancel_pending_save()
}

export function reload_config_from_disk(): void {
    cancel_pending_save()
    data = read_config_from_disk()
}

function saveToDisk(): void {
    cancel_pending_save()
    saveTimer = setTimeout(() => {
        write_config_to_disk()
        saveTimer = null
    }, 300)
}

function broadcastChange(key: ConfigKey, value: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send('config:changed', key, value)
        }
    }
}
