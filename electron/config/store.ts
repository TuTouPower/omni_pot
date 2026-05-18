import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { DEFAULT_CONFIG, DEFAULT_SERVICE_INSTANCES, APP_PRIMARY_COLORS } from '@shared/types/config'
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
    return config
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
    const locale = app.getLocale().toLowerCase()
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
            service_instances: {
                ...DEFAULT_SERVICE_INSTANCES,
                ...(data.service_instances ?? {})
            }
        }
        saveToDisk()
    }

    // Migrate: clear stale DeepL config that pointed to official API with empty key
    const deeplInst = data.service_instances?.['deepl@default']
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

    if (!data.hotkey_translate) {
        const legacy = (data.hotkey_selection_translate as string) || (data.hotkey_input_translate as string)
        if (legacy) {
            data.hotkey_translate = legacy
            saveToDisk()
        }
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
    return { ...DEFAULT_CONFIG, ...data }
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
