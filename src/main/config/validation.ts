import { DEFAULT_CONFIG, type ConfigKey } from '@shared/types/config'
import type { ServiceConfig } from '@shared/types/service'

const LOCAL_URL_KEYS = new Set(['requestPath'])
const REMOTE_URL_KEYS = new Set(['customUrl', 'custom_url', 'endpoint', 'url'])

function is_plain_object(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function is_service_config(value: unknown): value is ServiceConfig {
    if (!is_plain_object(value)) return false
    for (const [key, item] of Object.entries(value)) {
        if (item !== undefined && !['string', 'number', 'boolean'].includes(typeof item)) return false
        if (typeof item === 'string' && (LOCAL_URL_KEYS.has(key) || REMOTE_URL_KEYS.has(key)) && !is_allowed_service_url(item, LOCAL_URL_KEYS.has(key))) return false
    }
    return true
}

function is_allowed_service_url(value: string, allow_local: boolean): boolean {
    if (!value) return true
    try {
        const url = new URL(value)
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
        if (url.protocol === 'http:') return allow_local && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
        return true
    } catch {
        return false
    }
}

function is_service_instances(value: unknown): boolean {
    if (!is_plain_object(value)) return false
    for (const instance of Object.values(value)) {
        if (!is_plain_object(instance)) return false
        if (typeof instance.serviceKey !== 'string' || !instance.serviceKey) return false
        if (!is_service_config(instance.config)) return false
    }
    return true
}

export function is_config_value_allowed(key: ConfigKey, value: unknown): boolean {
    const default_val = DEFAULT_CONFIG[key]
    if (key === 'service_instances') return is_service_instances(value)
    if (Array.isArray(default_val)) return Array.isArray(value) && value.every((item) => typeof item === 'string')
    return typeof value === typeof default_val
}
