import { app, dialog, ipcMain, shell } from 'electron'
import { createReadStream, createWriteStream } from 'fs'
import { createHash } from 'crypto'
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
const REPO_NAME = 'omni_pot_release'

interface GitHubRelease {
    tag_name: string
    name: string
    body: string
    html_url: string
    published_at: string
    assets: Array<{ name: string; browser_download_url: string; size?: number; digest?: string }>
}

interface UpdateReleaseInfo {
    version: string
    current_version: string
    name: string
    body: string
    html_url: string
    published_at: string
    assets: Array<{ name: string; url: string; size?: number; digest?: string }>
}

interface DownloadAsset {
    name: string
    url: string
    digest?: string
}

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

interface DownloadProgress {
    downloaded: number
    total: number
    percent: number
}

function compare_versions(current: string, latest: string): boolean {
    const parse_version = (v: string) => {
        const cleaned = v.replace(/^v/, '')
        const [version = '0', ...pre_parts] = cleaned.split('-')
        const parts = version.split('.').map(Number)
        const major = parts[0] ?? 0
        const minor = parts[1] ?? 0
        const patch = parts[2] ?? 0
        const pre_release = pre_parts.length > 0 ? pre_parts.join('-') : null
        return { major, minor, patch, pre_release }
    }

    const cur = parse_version(current)
    const lat = parse_version(latest)

    // Compare major.minor.patch
    if (lat.major !== cur.major) return lat.major > cur.major
    if (lat.minor !== cur.minor) return lat.minor > cur.minor
    if (lat.patch !== cur.patch) return lat.patch > cur.patch

    // Same version numbers - pre-release handling
    // 1.2.0-beta < 1.2.0 (pre-release is less than release)
    if (cur.pre_release && !lat.pre_release) return true
    if (!cur.pre_release && lat.pre_release) return false
    if (cur.pre_release && lat.pre_release) {
        return lat.pre_release > cur.pre_release
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

export function assert_allowed_download_url(download_url: string, is_redirect: boolean): URL {
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

export function parse_sha256_digest(digest: string | undefined): string | null {
    if (!digest) return null
    const match = /^sha256:([a-f0-9]{64})$/i.exec(digest)
    const expected = match?.[1]
    if (!expected) throw new Error('Unsupported update asset digest')
    return expected.toLowerCase()
}

function hash_file_sha256(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256')
        const stream = createReadStream(path)
        stream.on('data', (chunk: Buffer) => { hash.update(chunk) })
        stream.on('error', reject)
        stream.on('end', () => { resolve(hash.digest('hex')) })
    })
}

async function verify_download_digest(path: string, digest: string | undefined): Promise<void> {
    const expected = parse_sha256_digest(digest)
    if (!expected) {
        if (process.env['OMNI_POT_E2E'] === '1') return
        throw new Error('Missing update asset digest')
    }
    const actual = await hash_file_sha256(path)
    if (actual !== expected) throw new Error('Update asset digest mismatch')
}

async function get_update_release_info(): Promise<UpdateReleaseInfo | null> {
    const resp = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
        headers: { 'User-Agent': 'omni_pot-updater' }
    })
    if (!resp.ok) throw new Error(`HTTP ${String(resp.status)}`)

    const release = await resp.json() as GitHubRelease
    const current_version = app.getVersion()
    const latest_version = release.tag_name.replace(/^v/, '')
    if (!compare_versions(current_version, latest_version)) return null

    return {
        version: latest_version,
        current_version,
        name: release.name,
        body: release.body,
        html_url: release.html_url,
        published_at: release.published_at,
        assets: release.assets.map((asset) => ({ name: asset.name, url: asset.browser_download_url, size: asset.size, digest: asset.digest })),
    }
}

export function assert_updater_sender(manager: WindowManager, web_contents: WebContents): void {
    if (manager.getLabelById(web_contents.id) !== WindowLabel.UPDATER) {
        throw new Error('Unauthorized updater IPC sender')
    }
}

export function registerUpdateHandlers(manager: WindowManager): void {
    ipcMain.handle('updater:downloadAndInstall', async (event, asset_name: string): Promise<{ success: boolean; path?: string; error?: string }> => {
        try {
            assert_updater_sender(manager, event.sender)
            const asset = resolve_bound_update_asset(asset_name)
            const output_path = await download_asset(asset, event.sender)
            await verify_download_digest(output_path, asset.digest)
            if (process.env['OMNI_POT_E2E'] !== '1') {
                const error = await shell.openPath(output_path)
                if (error) throw new Error(error)
            }
            return { success: true, path: output_path }
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
