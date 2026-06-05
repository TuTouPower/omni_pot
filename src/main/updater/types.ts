export type WindowsUpdateFileKey = 'windows_installer' | 'windows_portable'

export interface LatestMetadataFile {
    filename: string
    versioned_filename: string
    sha256: string
    size: number
    github_url: string
    r2_url: string
}

export interface LatestMetadata {
    format_version: 1
    version: string
    released_at: string
    files: Record<WindowsUpdateFileKey, LatestMetadataFile>
}

export interface UpdateReleaseInfo {
    version: string
    current_version: string
    name: string
    body: string
    html_url: string
    published_at: string
    assets: DownloadAsset[]
}

export interface DownloadAsset {
    name: string
    url: string
    size?: number
    digest?: string
    fallback_urls?: string[]
}

export interface DownloadProgress {
    downloaded: number
    total: number
    percent: number
}
