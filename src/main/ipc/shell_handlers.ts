import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { getUserDataDir } from '../config/store'
import { getLogDir, log } from '../log'
import { create_zip } from '../backup/index'
import type { BackupFile } from '../backup/index'
import { readdirSync, readFileSync, lstatSync } from 'fs'
import { join } from 'path'
import { assert_sender_label } from './sender_validation'

export const captured_open_external_urls: string[] = []

const IS_E2E = !!process.env.OMNI_POT_E2E

function is_allowed_external_url(value: string): boolean {
    try {
        const url = new URL(value)
        if (url.protocol !== 'https:') return false
        if (url.hostname === 'github.com'
            && (url.pathname === '/TuTouPower/omni_pot' || url.pathname.startsWith('/TuTouPower/omni_pot/'))) return true
        if (url.hostname === 'afdian.com'
            && (url.pathname === '/a/tutoupower' || url.pathname.startsWith('/a/tutoupower/'))) return true
        if (url.hostname === 'wj.qq.com') return true
        return false
    } catch {
        return false
    }
}

export async function open_external_safely(url: string): Promise<boolean> {
    if (!is_allowed_external_url(url)) return false
    if (IS_E2E) captured_open_external_urls.push(url)
    await shell.openExternal(url)
    return true
}

export function registerShellHandlers(manager: WindowManager): void {
    ipcMain.handle('shell:openExternal', async (event, url: string): Promise<boolean> => {
        assert_sender_label(manager, event, [WindowLabel.CONFIG], 'shell:openExternal')
        return open_external_safely(url)
    })

    ipcMain.handle('log:getDir', (event): string => {
        assert_sender_label(manager, event, [WindowLabel.CONFIG], 'log:getDir')
        return getLogDir(getUserDataDir())
    })

    ipcMain.handle('log:export', async (event): Promise<{ success: boolean; path?: string; error?: string }> => {
        assert_sender_label(manager, event, [WindowLabel.CONFIG], 'log:export')
        try {
            const logDir = getLogDir(getUserDataDir())
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
            const files: BackupFile[] = []
            for (const name of readdirSync(logDir)) {
                if (!name.endsWith('.log')) continue
                const filePath = join(logDir, name)
                const stat = lstatSync(filePath)
                if (stat.mtimeMs >= sevenDaysAgo) {
                    files.push({ name, data: readFileSync(filePath) })
                }
            }
            if (files.length === 0) return { success: false, error: 'No log files found in the last 7 days' }
            const win = BrowserWindow.getFocusedWindow()
            const options = {
                defaultPath: `omni-pot-logs-${new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)}.zip`,
                filters: [{ name: 'ZIP', extensions: ['zip'] }],
            }
            const result = win
                ? await dialog.showSaveDialog(win, options)
                : await dialog.showSaveDialog(options)
            if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' }
            create_zip(files, result.filePath)
            return { success: true, path: result.filePath }
        } catch (err) {
            return { success: false, error: String(err) }
        }
    })

    ipcMain.handle('log:write', (event, level: string, scope: string, message: string, ...args: unknown[]): void => {
        assert_sender_label(manager, event, [
            WindowLabel.CONFIG,
            WindowLabel.WELCOME,
            WindowLabel.TRANSLATE,
            WindowLabel.DICT,
            WindowLabel.RECOGNIZE,
            WindowLabel.SCREENSHOT,
            WindowLabel.TRAY,
            WindowLabel.UPDATER,
        ], 'log:write')
        const scoped = log.scope(`renderer:${scope}`)
        if (level === 'error') {
            scoped.error(message, ...args)
        } else if (level === 'warn') {
            scoped.warn(message, ...args)
        } else if (level === 'debug') {
            scoped.debug(message, ...args)
        } else {
            scoped.info(message, ...args)
        }
    })
}
