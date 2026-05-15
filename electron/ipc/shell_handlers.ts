import { ipcMain, shell } from 'electron'
import { getUserDataDir } from '../config/store'
import { getLogDir } from '../log'

function is_allowed_external_url(value: string): boolean {
    try {
        const url = new URL(value)
        return url.protocol === 'https:'
            && url.hostname === 'github.com'
            && (url.pathname === '/TuTouPower/omni_pot' || url.pathname.startsWith('/TuTouPower/omni_pot/'))
    } catch {
        return false
    }
}

export function registerShellHandlers(): void {
    ipcMain.handle('shell:openExternal', async (_event, url: string): Promise<boolean> => {
        if (!is_allowed_external_url(url)) return false
        await shell.openExternal(url)
        return true
    })

    ipcMain.handle('log:getDir', (): string => {
        return getLogDir(getUserDataDir())
    })
}
