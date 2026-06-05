import { app } from 'electron'
import type { WebContents } from 'electron'
import { createReadStream, createWriteStream } from 'fs'
import { createHash } from 'crypto'
import { mkdir, rm } from 'fs/promises'
import { get, type ClientRequest, type IncomingMessage } from 'http'
import { get as get_https } from 'https'
import { basename, join } from 'path'
import { log } from '../log'
import { assert_allowed_download_url } from './download_url'
import type { DownloadAsset, DownloadProgress } from './types'

const log_updater = log.scope('updater')

export function download_asset(asset: DownloadAsset, web_contents: WebContents): Promise<string> {
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

export async function verify_download_digest(path: string, digest: string | undefined): Promise<void> {
    const expected = parse_sha256_digest(digest)
    if (!expected) {
        if (process.env['OMNI_POT_E2E'] === '1') return
        throw new Error('Missing update asset digest')
    }
    const actual = await hash_file_sha256(path)
    if (actual !== expected) throw new Error('Update asset digest mismatch')
}
