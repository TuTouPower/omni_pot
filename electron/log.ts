import log from 'electron-log/main'
import { join } from 'path'
import { app } from 'electron'

export function initLog(userDataDir: string): void {
    log.transports.file.resolvePathFn = () => join(userDataDir, 'logs', 'main.log')
    log.transports.file.maxSize = 5 * 1024 * 1024
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
