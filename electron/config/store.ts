import { randomBytes } from 'crypto'
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'
import { DEFAULT_CONFIG, DEFAULT_SERVICE_INSTANCES, APP_PRIMARY_COLORS } from '@shared/types/config'
import { log } from '../log'
import { protect_config_secrets, unprotect_config_secrets, has_plain_config_secrets } from './secrets'
import type { AppConfig, ConfigKey } from '@shared/types/config'

const log_config = log.scope('config')

interface PersistedShape extends Partial<AppConfig> {
    __initialized?: boolean
    service_instances?: typeof DEFAULT_SERVICE_INSTANCES
}

let config_path: string
let data: PersistedShape = {}
let needs_secret_migration = false

function to_persisted_shape(value: unknown): PersistedShape {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const config = value as Record<string, unknown>
    if (Object.prototype.hasOwnProperty.call(config, '__proto__')
        || Object.prototype.hasOwnProperty.call(config, 'constructor')
        || Object.prototype.hasOwnProperty.call(config, 'prototype')) return {}
    return config
}

function read_config_from_disk(): PersistedShape {
    needs_secret_migration = false
    if (!existsSync(config_path)) return {}
    try {
        const persisted = to_persisted_shape(JSON.parse(readFileSync(config_path, 'utf-8')) as unknown)
        needs_secret_migration = has_plain_config_secrets(persisted)
        return to_persisted_shape(unprotect_config_secrets(persisted))
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
    const locale = app.getLocale().toLowerCase()
    if (locale.startsWith('zh')) return 'zh_cn'
    return 'en'
}


function create_server_api_token(): string {
    return randomBytes(32).toString('base64url')
}

function ensure_server_api_token(): boolean {
    if (typeof data.server_api_token === 'string' && data.server_api_token) return false
    data.server_api_token = create_server_api_token()
    return true
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
            const preset = to_persisted_shape(JSON.parse(process.env['OMNI_POT_PRESET_CONFIG']) as unknown)
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
            server_api_token: typeof data.server_api_token === 'string' && data.server_api_token ? data.server_api_token : create_server_api_token(),
            service_instances: {
                ...DEFAULT_SERVICE_INSTANCES,
                ...(data.service_instances ?? {})
            }
        }
        saveToDisk()
    }

    if (ensure_server_api_token()) {
        saveToDisk()
    }

    data.service_instances = {
        ...DEFAULT_SERVICE_INSTANCES,
        ...(data.service_instances ?? {})
    }
    const service_instances = data.service_instances as Partial<typeof DEFAULT_SERVICE_INSTANCES>

    // Migrate: clear stale DeepL config that pointed to official API with empty key
    const deeplInst = service_instances['deepl@default']
    if (deeplInst && (deeplInst.config as Record<string, unknown>).type === 'free'
        && !(deeplInst.config as Record<string, unknown>).authKey) {
        deeplInst.config = {}
        saveToDisk()
    }

    if ((data as Record<string, unknown>)['dev_mode'] !== undefined) {
        delete (data as Record<string, unknown>)['dev_mode']
        saveToDisk()
    }

    // Migrate: replace the old factory default translate_service_list
    // (bing/google/deepl) with the new free defaults (bing/deepl/mymemory)
    // for users who never customized it. Leave user-customized lists alone.
    const OLD_DEFAULT_TRANSLATE_LIST = ['bing@default', 'google@default', 'deepl@default']
    if (Array.isArray(data.translate_service_list)
        && data.translate_service_list.length === OLD_DEFAULT_TRANSLATE_LIST.length
        && data.translate_service_list.every((v, i) => v === OLD_DEFAULT_TRANSLATE_LIST[i])) {
        data.translate_service_list = [...DEFAULT_CONFIG.translate_service_list]
        saveToDisk()
    }

    if (typeof data.app_primary_color !== 'string'
        || !(APP_PRIMARY_COLORS as readonly string[]).includes(data.app_primary_color)) {
        data.app_primary_color = DEFAULT_CONFIG.app_primary_color
        saveToDisk()
    }

    const legacy_auto_copy = (data as Record<string, unknown>)['translate_auto_copy']
    if (typeof legacy_auto_copy === 'string') {
        data.translate_auto_copy = legacy_auto_copy !== 'disable'
        saveToDisk()
    }

    if (needs_secret_migration) {
        write_config_to_disk()
        needs_secret_migration = false
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
    log_config.info('set %s', key)
    ;(data as Record<string, unknown>)[key] = value
    saveToDisk()
    broadcastChange(key, value)
}

export function resetConfigToDefaults(): void {
    const server_api_token = typeof data.server_api_token === 'string' && data.server_api_token
        ? data.server_api_token
        : create_server_api_token()
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
        ;(data as Record<string, unknown>)[key] = value
    }
    data.server_api_token = server_api_token
    saveToDisk()
    broadcastAllConfig()
}

export function getAllConfig(): AppConfig {
    return { ...DEFAULT_CONFIG, ...data }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function write_config_to_disk(): void {
    const tmp_path = config_path + '.tmp'
    writeFileSync(tmp_path, JSON.stringify(protect_config_secrets(data), null, 2), 'utf-8')
    renameSync(tmp_path, config_path)
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
    const changed = ensure_server_api_token() || needs_secret_migration
    if (changed) {
        write_config_to_disk()
        needs_secret_migration = false
    }
}

function saveToDisk(): void {
    cancel_pending_save()
    saveTimer = setTimeout(() => {
        write_config_to_disk()
        saveTimer = null
    }, 300)
}

type ConfigChangeListener = (key: ConfigKey, value: unknown) => void
const config_change_listeners: ConfigChangeListener[] = []

export function onConfigChanged(listener: ConfigChangeListener): void {
    config_change_listeners.push(listener)
}

function broadcastChange(key: ConfigKey, value: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send('config:changed', key, value)
        }
    }
    for (const listener of config_change_listeners) {
        listener(key, value)
    }
}

export function broadcastAllConfig(): void {
    const all = { ...DEFAULT_CONFIG, ...data }
    for (const [key, value] of Object.entries(all)) {
        broadcastChange(key as ConfigKey, value)
    }
}
