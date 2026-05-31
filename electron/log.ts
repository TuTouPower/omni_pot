import log from 'electron-log/main'
import { join } from 'path'
import { app } from 'electron'

type LogHook = (typeof log.hooks)[number]

const SENSITIVE_LOG_KEYS = ['api_key', 'apikey', 'appkey', 'key', 'password', 'secret', 'token']

function is_sensitive_log_key(key: string): boolean {
    const normalized_key = key.toLowerCase().replace(/[^a-z0-9]/g, '')
    return SENSITIVE_LOG_KEYS.some((sensitive_key) => normalized_key.includes(sensitive_key))
}

function redact_secret(value: string): string {
    if (value.length <= 8) return '[redacted]'
    return `${value.slice(0, 4)}…${value.slice(-4)}`
}

export function redact_log_value(value: unknown): unknown {
    if (value instanceof Error) return value
    if (Array.isArray(value)) return value.map(redact_log_value)
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
            key,
            is_sensitive_log_key(key) && typeof entry === 'string' ? redact_secret(entry) : redact_log_value(entry),
        ]))
    }
    return value
}

const redact_log_message: LogHook = (message) => ({
    ...message,
    data: message.data.map(redact_log_value),
})

export function initLog(userDataDir: string): void {
    log.transports.file.resolvePathFn = () => join(userDataDir, 'logs', 'main.log')
    log.transports.file.maxSize = 5 * 1024 * 1024
    if (!log.hooks.includes(redact_log_message)) log.hooks.push(redact_log_message)

    // Force Asia/Shanghai (UTC+8) timezone in log timestamps
    log.transports.file.format = ({ message, data }: { message: { date?: Date; level: string; scope?: string }; data: unknown[] }) => {
        const utcMs = (message?.date ?? new Date()).getTime()
        const cst = new Date(utcMs + 8 * 3600000)
        const ts = cst.toISOString().replace('T', ' ').replace('Z', '')
        const level = (message?.level || 'info').toUpperCase().padEnd(5)
        const scope = message?.scope ? ` (${message.scope})` : ''
        const text = data.map(String).join(' ')
        return `[${ts}] [${level}]${scope} ${text}`
    }

    if (app.isPackaged) {
        log.transports.file.level = 'info'
        log.transports.console.level = false
    } else {
        log.transports.file.level = 'debug'
        log.transports.console.level = 'debug'
    }
    log.initialize()
    log.errorHandler.startCatching()
}

export function getLogDir(userDataDir: string): string {
    return join(userDataDir, 'logs')
}

export { log }
