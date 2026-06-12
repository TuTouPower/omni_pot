import { app, dialog, ipcMain, shell } from 'electron'
import { rm } from 'fs/promises'
import type { WebContents } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { getConfig } from '../config/store'
import { get_sender_label } from '../ipc/sender_validation'
import { log } from '../log'
import { download_asset, verify_download_digest } from './download'
import { get_update_release_info } from './latest_metadata'
import type { DownloadAsset, UpdateReleaseInfo } from './types'

export { assert_allowed_download_url } from './download_url'
export { parse_sha256_digest } from './download'
export { get_update_release_info, parse_latest_metadata } from './latest_metadata'

const log_updater = log.scope('updater')

let bound_update_assets = new Map<string, DownloadAsset>()

export function bind_update_release_assets(assets: DownloadAsset[]): void {
    bound_update_assets = new Map(assets.map((asset) => [asset.name, asset]))
}

export function resolve_bound_update_asset(asset_name: unknown): DownloadAsset {
    if (typeof asset_name !== 'string') throw new Error('Invalid update asset')
    const asset = bound_update_assets.get(asset_name)
    if (!asset) throw new Error('Unknown update asset')
    return asset
}

export function assert_updater_sender(manager: WindowManager, web_contents: WebContents): void {
    if (get_sender_label(manager, web_contents) !== WindowLabel.UPDATER) {
        throw new Error('Unauthorized updater IPC sender')
    }
}

export function registerUpdateHandlers(manager: WindowManager): void {
    ipcMain.handle('updater:downloadAndInstall', async (event, asset_name: string): Promise<{ success: boolean; path?: string; error?: string }> => {
        try {
            assert_updater_sender(manager, event.sender)
            const asset = resolve_bound_update_asset(asset_name)
            const download_urls = [asset.url, ...(asset.fallback_urls ?? [])]
            let last_error: unknown = null
            for (const download_url of download_urls) {
                try {
                    const output_path = await download_asset({ ...asset, url: download_url }, event.sender)
                    try {
                        await verify_download_digest(output_path, asset.digest)
                    } catch (verify_error) {
                        await rm(output_path, { force: true })
                        throw verify_error
                    }
                    if (process.env['OMNI_POT_E2E'] !== '1') {
                        const error = await shell.openPath(output_path)
                        if (error) throw new Error(error)
                    }
                    return { success: true, path: output_path }
                } catch (error) {
                    last_error = error
                    log_updater.warn('update download failed from %s: %s', download_url, error)
                }
            }
            throw last_error instanceof Error ? last_error : new Error('Download failed')
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })

    ipcMain.handle('updater:checkLatest', async (event): Promise<{ success: boolean; release?: UpdateReleaseInfo; error?: string }> => {
        try {
            assert_updater_sender(manager, event.sender)
            const release_info = await get_update_release_info()
            if (release_info) bind_update_release_assets(release_info.assets)
            return release_info ? { success: true, release: release_info } : { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })
}

export async function checkForUpdate(manager: WindowManager, silent = true): Promise<void> {
    if (silent) {
        const enabled = getConfig('check_update')
        if (!enabled) return
    }

    try {
        const release_info = await get_update_release_info()
        const current_version = app.getVersion()
        if (!release_info) {
            if (!silent) {
                dialog.showMessageBox({
                    type: 'info',
                    title: 'No Updates',
                    message: `You are already on the latest version (${current_version}).`
                }).catch((err: unknown) => { log_updater.error(err) })
            }
            return
        }

        manager.focusOrCreate(WindowLabel.UPDATER, {
            label: WindowLabel.UPDATER,
            width: 480,
            height: 520,
            resizable: true
        })

        bind_update_release_assets(release_info.assets)
        manager.sendWhenReady(WindowLabel.UPDATER, 'updater:release', release_info)
    } catch (err) {
        if (!silent) {
            dialog.showErrorBox('Update Check Failed', String(err))
        }
    }
}
