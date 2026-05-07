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

/** Map Electron locale to our app language code and default target language. */
function resolveSystemLanguage(): string {
    const locale = (app.getLocale() ?? 'en').toLowerCase()
    if (locale.startsWith('zh')) return 'zh_cn'
    return 'en'
}

export function initConfigStore(): void {
    const dir = app.getPath('userData')
    config_path = join(dir, 'config.json')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    if (existsSync(config_path)) {
        try {
            data = JSON.parse(readFileSync(config_path, 'utf-8')) as PersistedShape
        } catch {
            data = {}
        }
    } else {
        data = {}
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

function saveToDisk(): void {
    writeFileSync(config_path, JSON.stringify(data, null, 2), 'utf-8')
}

function broadcastChange(key: ConfigKey, value: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send('config:changed', key, value)
        }
    }
}
