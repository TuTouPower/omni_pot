import { app } from 'electron'
import { log } from '../log'
import { compare_versions } from './version'
import type { LatestMetadata, LatestMetadataFile, UpdateReleaseInfo, WindowsUpdateFileKey } from './types'

const log_updater = log.scope('updater')

const REPO_OWNER = 'TuTouPower'
const REPO_NAME = 'omni_pot_release'

const LATEST_METADATA_SOURCES = [
    { name: 'github', url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/latest.json` },
    { name: 'r2', url: 'https://downloads.zzzkkkccc.site/omni-pot/latest.json' },
] as const

type MetadataSource = typeof LATEST_METADATA_SOURCES[number]

type LatestMetadataSourceName = MetadataSource['name']

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

async function fetch_latest_metadata(source: { name: LatestMetadataSourceName; url: string }): Promise<LatestMetadata> {
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
        .filter((item): item is { result: PromiseRejectedResult; source: MetadataSource } => item.result.status === 'rejected')
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
