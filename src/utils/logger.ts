type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function write(level: LogLevel, scope: string, message: string, ...args: unknown[]): void {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- safety for non-Electron contexts
    window.electronAPI?.log.write(level, scope, message, ...args).catch?.(() => { return undefined })
}

export function create_logger(scope: string) {
    return {
        debug: (message: string, ...args: unknown[]): void => { write('debug', scope, message, ...args) },
        info: (message: string, ...args: unknown[]): void => { write('info', scope, message, ...args) },
        warn: (message: string, ...args: unknown[]): void => { write('warn', scope, message, ...args) },
        error: (message: string, ...args: unknown[]): void => { write('error', scope, message, ...args) },
    }
}
