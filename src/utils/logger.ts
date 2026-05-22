type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function write(level: LogLevel, scope: string, message: string, ...args: unknown[]): void {
    window.electronAPI?.log.write(level, scope, message, ...args).catch(() => {})
}

export function create_logger(scope: string) {
    return {
        debug: (message: string, ...args: unknown[]) => write('debug', scope, message, ...args),
        info: (message: string, ...args: unknown[]) => write('info', scope, message, ...args),
        warn: (message: string, ...args: unknown[]) => write('warn', scope, message, ...args),
        error: (message: string, ...args: unknown[]) => write('error', scope, message, ...args),
    }
}
