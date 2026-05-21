import { app, dialog, ipcMain, shell } from 'electron'
import { createWriteStream } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { get, type ClientRequest, type IncomingMessage } from 'http'
import { get as get_https } from 'https'
import { basename, join } from 'path'
import type { WebContents } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { getConfig } from '../config/store'
import { log } from '../log'

const log_updater = log.scope('updater')

const REPO_OWNER = 'TuTouPower'
const REPO_NAME = 'omni_pot'

interface GitHubRelease {
    tag_name: string
    name: string
    body: string
    html_url: string
    assets: Array<{ name: string; browser_download_url: string; size?: number }>
}

interface DownloadAsset {
    name: string
    url: string
}

interface DownloadProgress {
    downloaded: number
    total: number
    percent: number
}

function compare_versions(current: string, latest: string): boolean {
    const cur = current.replace(/^v/, '').split('.').map(Number)
    const lat = latest.replace(/^v/, '').split('.').map(Number)
    for (let i = 0; i < 3; i++) {
        if ((lat[i] ?? 0) > (cur[i] ?? 0)) return true
        if ((lat[i] ?? 0) < (cur[i] ?? 0)) return false
    }
    return false
}

function is_e2e_update_url(url: URL): boolean {
    return process.env['OMNI_POT_E2E'] === '1' && url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
}

function is_release_asset_url(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname === 'github.com' && url.pathname.startsWith(`/${REPO_OWNER}/${REPO_NAME}/releases/download/`)
}

function is_release_redirect_url(url: URL): boolean {
    return url.protocol === 'https:' && (
        url.hostname === 'objects.githubusercontent.com' ||
        url.hostname.endsWith('.githubusercontent.com')
    )
}

function assert_allowed_download_url(download_url: string, is_redirect: boolean): URL {
    const parsed_url = new URL(download_url)
    if (is_e2e_update_url(parsed_url)) return parsed_url
    if (is_redirect ? is_release_redirect_url(parsed_url) : is_release_asset_url(parsed_url)) return parsed_url
    throw new Error('Unsupported update download URL')
}

function download_asset(asset: DownloadAsset, web_contents: WebContents): Promise<string> {
    return new Promise((resolve, reject) => {
        const safe_name = basename(asset.name).replace(/[^a-zA-Z0-9._ -]/g, '_') || 'omni_pot_update'
        let settled = false
        let active_request: ClientRequest | null = null
        let active_response: IncomingMessage | null = null
        let active_file: ReturnType<typeof createWriteStream> | null = null

        mkdir(join(app.getPath('temp'), 'omni_pot-updates'), { recursive: true })
            .then(() => {
                const output_path = join(app.getPath('temp'), 'omni_pot-updates', safe_name)

                const remove_partial = (): void => {
                    rm(output_path, { force: true }).catch((err: unknown) => { log_updater.warn('failed to remove partial update: %s', err) })
                }

                const fail = (error: Error): void => {
                    if (settled) return
                    settled = true
                    const file = active_file
                    if (file) active_response?.unpipe(file)
                    active_response?.destroy()
                    active_request?.destroy()
                    if (file && !file.closed) {
                        file.once('close', () => {
                            remove_partial()
                            reject(error)
                        })
                        file.destroy()
                        return
                    }
                    remove_partial()
                    reject(error)
                }

                const start_request = (download_url: string, redirect_count: number): void => {
                    let parsed_url: URL
                    try {
                        parsed_url = assert_allowed_download_url(download_url, redirect_count > 0)
                    } catch (error) {
                        fail(error instanceof Error ? error : new Error(String(error)))
                        return
                    }

                    const client = parsed_url.protocol === 'http:' ? get : get_https
                    const request = client(parsed_url, { headers: { 'User-Agent': 'omni_pot-updater' } }, (response) => {
                        active_response = response
                        const location = response.headers.location
                        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && location) {
                            response.resume()
                            if (redirect_count >= 5) {
                                fail(new Error('Too many redirects'))
                                return
                            }
                            start_request(new URL(location, parsed_url).toString(), redirect_count + 1)
                            return
                        }

                        if (response.statusCode !== 200) {
                            response.resume()
                            fail(new Error(`HTTP ${String(response.statusCode)}`))
                            return
                        }

                        const file = createWriteStream(output_path)
                        active_file = file
                        const total = Number(response.headers['content-length'] ?? 0)
                        let downloaded = 0

                        response.on('data', (chunk: Buffer) => {
                            downloaded += chunk.length
                            const progress: DownloadProgress = {
                                downloaded,
                                total,
                                percent: total > 0 ? Math.round((downloaded / total) * 100) : 0,
                            }
                            web_contents.send('updater:download-progress', progress)
                        })
                        response.on('error', fail)
                        response.on('aborted', () => { fail(new Error('Download aborted')) })
                        file.on('error', fail)
                        file.on('finish', () => {
                            file.close((error) => {
                                if (error) {
                                    fail(error)
                                    return
                                }
                                if (total > 0 && downloaded !== total) {
                                    fail(new Error('Incomplete download'))
                                    return
                                }
                                if (settled) return
                                settled = true
                                resolve(output_path)
                            })
                        })
                        response.pipe(file)
                    })
                    active_request = request
                    request.on('error', fail)
                }

                start_request(asset.url, 0)
            })
            .catch((error: unknown) => { reject(error instanceof Error ? error : new Error(String(error))) })
    })
}

export function registerUpdateHandlers(): void {
    ipcMain.handle('updater:downloadAndInstall', async (event, asset: DownloadAsset): Promise<{ success: boolean; path?: string; error?: string }> => {
        try {
            const output_path = await download_asset(asset, event.sender)
            if (process.env['OMNI_POT_E2E'] !== '1') {
                const error = await shell.openPath(output_path)
                if (error) throw new Error(error)
            }
            return { success: true, path: output_path }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })
}

export async function checkForUpdate(manager: WindowManager, silent = true): Promise<void> {
    const enabled = getConfig('check_update')
    if (!enabled) return

    try {
        const resp = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
            headers: { 'User-Agent': 'omni_pot-updater' }
        })
        if (!resp.ok) {
            if (!silent) dialog.showErrorBox('Update Check Failed', `HTTP ${String(resp.status)}`)
            return
        }

        const release = await resp.json() as GitHubRelease
        const current_version = app.getVersion()
        const latest_version = release.tag_name.replace(/^v/, '')

        if (!compare_versions(current_version, latest_version)) {
            if (!silent) {
                dialog.showMessageBox({
                    type: 'info',
                    title: 'No Updates',
                    message: `You are already on the latest version (${current_version}).`
                }).catch((err: unknown) => { log_updater.error(err) })
            }
            return
        }

        // Open updater window with release info
        manager.focusOrCreate(WindowLabel.UPDATER, {
            label: WindowLabel.UPDATER,
            width: 480,
            height: 520,
            resizable: true
        })

        // Send release data to updater window once ready
        manager.sendWhenReady(WindowLabel.UPDATER, 'updater:release', {
            version: latest_version,
            current_version,
            name: release.name,
            body: release.body,
            html_url: release.html_url,
            assets: release.assets.map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size }))
        })
    } catch (err) {
        if (!silent) {
            dialog.showErrorBox('Update Check Failed', String(err))
        }
    }
}
