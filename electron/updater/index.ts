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
import { get_sender_label } from '../ipc/sender_validation'
import { log } from '../log'

const log_updater = log.scope('updater')

const REPO_OWNER = 'TuTouPower'
const REPO_NAME = 'omni_pot_release'

const LATEST_METADATA_SOURCES = [
    { name: 'github', url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/latest.json` },
    { name: 'r2', url: 'https://downloads.zzzkkkccc.site/omni-pot/latest.json' },
] as const

type LatestMetadataSource = typeof LATEST_METADATA_SOURCES[number]['name']
type WindowsUpdateFileKey = 'windows_installer' | 'windows_portable'

interface LatestMetadataFile {
    filename: string
    versioned_filename: string
    sha256: string
    size: number
    github_url: string
    r2_url: string
}

interface LatestMetadata {
    format_version: 1
    version: string
    released_at: string
    files: Record<WindowsUpdateFileKey, LatestMetadataFile>
}

interface UpdateReleaseInfo {
    version: string
    current_version: string
    name: string
    body: string
    html_url: string
    published_at: string
    assets: Array<{ name: string; url: string; size?: number; digest?: string; fallback_urls?: string[] }>
}

interface DownloadAsset {
    name: string
    url: string
    digest?: string
    fallback_urls?: string[]
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
        const cur_parts = cur.pre_release.split('.').map((p) => { const n = Number(p); return Number.isNaN(n) ? p : n })
        const lat_parts = lat.pre_release.split('.').map((p) => { const n = Number(p); return Number.isNaN(n) ? p : n })
        for (let i = 0; i < Math.max(cur_parts.length, lat_parts.length); i++) {
            const c = cur_parts[i] ?? 0
            const l = lat_parts[i] ?? 0
            if (typeof c === 'number' && typeof l === 'number') {
                if (l !== c) return l > c
            } else {
                const cs = String(c)
                const ls = String(l)
                if (ls !== cs) return ls > cs
            }
        }
        return false
    }

    return false
}

function is_e2e_update_url(url: URL): boolean {
    return process.env['OMNI_POT_E2E'] === '1' && url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
}

function is_release_asset_url(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname === 'github.com' && /^\/TuTouPower\/omni_pot_release\/releases\/download\/v([^/]+)\/OmniPot\1(?:-portable)?\.exe$/.test(url.pathname)
}

function is_release_redirect_url(url: URL): boolean {
    return url.protocol === 'https:' && (
        url.hostname === 'objects.githubusercontent.com' ||
        url.hostname.endsWith('.githubusercontent.com')
    )
}

function is_r2_update_url(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname === 'downloads.zzzkkkccc.site' && /^\/omni-pot\/latest\/OmniPot\d+\.\d+\.\d+(?:-portable)?\.exe$/.test(url.pathname)
}

export function assert_allowed_download_url(download_url: string, is_redirect: boolean): URL {
    const parsed_url = new URL(download_url)
    if (is_e2e_update_url(parsed_url)) return parsed_url
    if (is_r2_update_url(parsed_url)) return parsed_url
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

function assert_object(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid latest metadata ${field}`)
    return value as Record<string, unknown>
}

function assert_string(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid latest metadata ${field}`)
    return value
}

function assert_size(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`Invalid latest metadata ${field}`)
    return value
}

function parse_latest_metadata_file(value: unknown, file_key: WindowsUpdateFileKey, version: string): LatestMetadataFile {
    const file = assert_object(value, `files.${file_key}`)
    const filename = assert_string(file['filename'], `files.${file_key}.filename`)
    const versioned_filename = assert_string(file['versioned_filename'], `files.${file_key}.versioned_filename`)
    if (filename !== versioned_filename) throw new Error(`Invalid latest metadata files.${file_key}.versioned_filename`)
    const expected_filename = file_key === 'windows_portable' ? `OmniPot${version}-portable.exe` : `OmniPot${version}.exe`
    if (filename !== expected_filename) throw new Error(`Invalid latest metadata files.${file_key}.filename`)
    const sha256 = assert_string(file['sha256'], `files.${file_key}.sha256`).toLowerCase()
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`Invalid latest metadata files.${file_key}.sha256`)
    const github_url = assert_string(file['github_url'], `files.${file_key}.github_url`)
    const r2_url = assert_string(file['r2_url'], `files.${file_key}.r2_url`)
    if (github_url !== `https://github.com/TuTouPower/omni_pot_release/releases/download/v${version}/${filename}`) throw new Error(`Invalid latest metadata files.${file_key}.github_url`)
    if (r2_url !== `https://downloads.zzzkkkccc.site/omni-pot/latest/${filename}`) throw new Error(`Invalid latest metadata files.${file_key}.r2_url`)
    return {
        filename,
        versioned_filename,
        sha256,
        size: assert_size(file['size'], `files.${file_key}.size`),
        github_url,
        r2_url,
    }
}

export function parse_latest_metadata(value: unknown): LatestMetadata {
    const metadata = assert_object(value, 'root')
    if (metadata['format_version'] !== 1) throw new Error('Unsupported latest metadata format_version')
    const version = assert_string(metadata['version'], 'version').replace(/^v/, '')
    const files = assert_object(metadata['files'], 'files')
    return {
        format_version: 1,
        version,
        released_at: assert_string(metadata['released_at'], 'released_at'),
        files: {
            windows_installer: parse_latest_metadata_file(files['windows_installer'], 'windows_installer', version),
            windows_portable: parse_latest_metadata_file(files['windows_portable'], 'windows_portable', version),
        },
    }
}

async function fetch_latest_metadata(source: { name: LatestMetadataSource; url: string }): Promise<LatestMetadata> {
    const resp = await fetch(source.url, { headers: { 'User-Agent': 'omni_pot-updater' } })
    if (!resp.ok) throw new Error(`${source.name} HTTP ${String(resp.status)}`)
    try {
        return parse_latest_metadata(await resp.json())
    } catch (error) {
        throw new Error(`${source.name} ${error instanceof Error ? error.message : String(error)}`)
    }
}

function assert_matching_latest_metadata(github_metadata: LatestMetadata, r2_metadata: LatestMetadata): void {
    if (github_metadata.version !== r2_metadata.version) throw new Error('Latest metadata conflict: version mismatch')
    for (const key of ['windows_installer', 'windows_portable'] as WindowsUpdateFileKey[]) {
        const github_file = github_metadata.files[key]
        const r2_file = r2_metadata.files[key]
        if (github_file.sha256 !== r2_file.sha256 || github_file.size !== r2_file.size) {
            throw new Error(`Latest metadata conflict: ${key} mismatch`)
        }
    }
}

function is_not_found_metadata_error(reason: unknown): boolean {
    return reason instanceof Error && / HTTP 404$/.test(reason.message)
}

async function get_latest_metadata(): Promise<LatestMetadata | null> {
    const results = await Promise.allSettled(LATEST_METADATA_SOURCES.map((source) => fetch_latest_metadata(source)))
    const failures = results
        .map((result, index) => ({ result, source: LATEST_METADATA_SOURCES[index] }))
        .filter((item): item is { result: PromiseRejectedResult; source: typeof LATEST_METADATA_SOURCES[number] } => item.result.status === 'rejected')
    const unsupported = failures.find((item) => String(item.result.reason).includes('Unsupported latest metadata format_version'))
    if (unsupported) {
        log_updater.error('unsupported latest metadata format_version from %s: %s', unsupported.source.name, unsupported.result.reason)
        throw new Error('Unsupported latest metadata format_version')
    }
    for (const failure of failures) {
        log_updater.warn('failed to fetch latest metadata from %s: %s', failure.source.name, failure.result.reason)
    }

    const [github_result, r2_result] = results as [PromiseSettledResult<LatestMetadata>, PromiseSettledResult<LatestMetadata>]
    const github_metadata = github_result.status === 'fulfilled' ? github_result.value : null
    const r2_metadata = r2_result.status === 'fulfilled' ? r2_result.value : null
    if (github_metadata && r2_metadata) {
        assert_matching_latest_metadata(github_metadata, r2_metadata)
        return r2_metadata
    }
    if (r2_metadata) return r2_metadata
    if (github_metadata) return github_metadata
    if (failures.length === results.length && failures.every((failure) => is_not_found_metadata_error(failure.result.reason))) return null
    throw new Error(failures.map((failure) => String(failure.result.reason)).join('; ') || 'No latest metadata available')
}

export function get_windows_update_file_key(): WindowsUpdateFileKey {
    return process.env['PORTABLE_EXECUTABLE_DIR'] ? 'windows_portable' : 'windows_installer'
}

export async function get_update_release_info(): Promise<UpdateReleaseInfo | null> {
    const metadata = await get_latest_metadata()
    const current_version = app.getVersion()
    if (!metadata) return null
    const latest_version = metadata.version
    if (!compare_versions(current_version, latest_version)) return null

    const file = metadata.files[get_windows_update_file_key()]
    return {
        version: latest_version,
        current_version,
        name: `Omni Pot ${latest_version}`,
        body: '',
        html_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
        published_at: metadata.released_at,
        assets: [{
            name: file.filename,
            url: file.r2_url,
            size: file.size,
            digest: `sha256:${file.sha256}`,
            fallback_urls: [file.github_url],
        }],
    }
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
