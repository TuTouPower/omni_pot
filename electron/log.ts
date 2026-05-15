import log from 'electron-log/main'
import { join } from 'path'

export function initLog(userDataDir: string): void {
    log.transports.file.resolvePathFn = () => join(userDataDir, 'logs', 'main.log')
    log.transports.file.maxSize = 5 * 1024 * 1024
    log.transports.console.level = 'debug'
    log.initialize()
    log.errorHandler.startCatching()
}

export function getLogDir(userDataDir: string): string {
    return join(userDataDir, 'logs')
}

export { log }
