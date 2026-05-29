import { safeStorage } from 'electron'
import type { AppConfig, ServiceInstancesMap } from '@shared/types/config'
import { log } from '../log'

const log_config_secrets = log.scope('config-secrets')
const SECRET_MARKER_KEY = '__omni_pot_secret'
const SECRET_MARKER_VERSION = 1

interface SecretMarker {
    [SECRET_MARKER_KEY]: typeof SECRET_MARKER_VERSION
    data: string
}

type ConfigRecord = Record<string, unknown>

const top_level_secret_keys = new Set(['server_api_token', 'webdav_password'])
const service_secret_key_pattern = /(^|_)(password|secret|token|api_?key|app_?key|auth_?key|client_secret|access_?key|accesskey_secret)($|_)/i

function is_record(value: unknown): value is ConfigRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}

function is_secret_marker(value: unknown): value is SecretMarker {
    return is_record(value)
        && value[SECRET_MARKER_KEY] === SECRET_MARKER_VERSION
        && typeof value.data === 'string'
}

function is_service_secret_key(key: string): boolean {
    return service_secret_key_pattern.test(key)
}

function has_service_instance_plain_secrets(service_instances: unknown): boolean {
    if (!is_record(service_instances)) return false
    for (const instance_value of Object.values(service_instances)) {
        if (!is_record(instance_value) || !is_record(instance_value.config)) continue
        for (const [key, value] of Object.entries(instance_value.config)) {
            if (is_service_secret_key(key) && value !== undefined && value !== '' && !is_secret_marker(value)) {
                return true
            }
        }
    }
    return false
}

export function has_plain_config_secrets(config: Partial<AppConfig>): boolean {
    const config_record = config as ConfigRecord
    for (const key of top_level_secret_keys) {
        const value = config_record[key]
        if (value !== undefined && value !== '' && !is_secret_marker(value)) return true
    }
    return has_service_instance_plain_secrets(config.service_instances)
}

function encrypt_secret(value: unknown): SecretMarker | undefined {
    if (value === undefined || value === '') return value as undefined
    if (!safeStorage.isEncryptionAvailable()) {
        log_config_secrets.warn('safeStorage unavailable; omitting persisted secret')
        return undefined
    }
    return {
        [SECRET_MARKER_KEY]: SECRET_MARKER_VERSION,
        data: safeStorage.encryptString(JSON.stringify(value)).toString('base64'),
    }
}

function decrypt_secret(value: unknown): unknown {
    if (!is_secret_marker(value)) return value
    try {
        const decrypted = safeStorage.decryptString(Buffer.from(value.data, 'base64'))
        return JSON.parse(decrypted) as unknown
    } catch (error) {
        log_config_secrets.warn('failed to decrypt persisted secret: %s', error instanceof Error ? error.message : String(error))
        return undefined
    }
}

function clone_config(config: Partial<AppConfig>): ConfigRecord {
    return structuredClone(config)
}

function transform_service_instance_secrets(
    service_instances: unknown,
    transform: (key: string, value: unknown) => unknown,
): unknown {
    if (!is_record(service_instances)) return service_instances
    const result: ServiceInstancesMap = {}
    for (const [instance_key, instance_value] of Object.entries(service_instances)) {
        if (!is_record(instance_value)) {
            ;(result as ConfigRecord)[instance_key] = instance_value
            continue
        }
        const config = is_record(instance_value.config) ? { ...instance_value.config } : instance_value.config
        if (is_record(config)) {
            for (const [key, value] of Object.entries(config)) {
                if (is_service_secret_key(key)) {
                    const transformed = transform(key, value)
                    if (transformed === undefined) config[key] = undefined
                    else config[key] = transformed
                }
            }
        }
        ;(result as ConfigRecord)[instance_key] = { ...instance_value, config }
    }
    return result
}

export function protect_config_secrets(config: Partial<AppConfig>): Partial<AppConfig> {
    const protected_config = clone_config(config)
    for (const key of top_level_secret_keys) {
        if (Object.prototype.hasOwnProperty.call(protected_config, key)) {
            const protected_value = encrypt_secret(protected_config[key])
            if (protected_value === undefined) protected_config[key] = undefined
            else protected_config[key] = protected_value
        }
    }
    protected_config.service_instances = transform_service_instance_secrets(
        protected_config.service_instances,
        (_key, value) => encrypt_secret(value),
    )
    return protected_config
}

export function unprotect_config_secrets(config: Partial<AppConfig>): Partial<AppConfig> {
    const unprotected_config = clone_config(config)
    for (const key of top_level_secret_keys) {
        if (Object.prototype.hasOwnProperty.call(unprotected_config, key)) {
            const value = decrypt_secret(unprotected_config[key])
            if (value === undefined) unprotected_config[key] = undefined
            else unprotected_config[key] = value
        }
    }
    unprotected_config.service_instances = transform_service_instance_secrets(
        unprotected_config.service_instances,
        (_key, value) => decrypt_secret(value),
    )
    return unprotected_config
}

export function sanitize_config_secrets(config: Partial<AppConfig>): Partial<AppConfig> {
    const sanitized_config = clone_config(config)
    for (const key of top_level_secret_keys) {
        sanitized_config[key] = undefined
    }
    sanitized_config.service_instances = transform_service_instance_secrets(
        sanitized_config.service_instances,
        () => undefined,
    )
    return sanitized_config
}
