import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'

interface ReleaseAsset {
    name: string
    url: string
    size?: number
}

interface ReleaseInfo {
    version: string
    current_version: string
    name: string
    body: string
    html_url: string
    published_at: string
    assets: ReleaseAsset[]
}

interface DownloadProgress {
    downloaded: number
    total: number
    percent: number
}

const REPO_OWNER = 'TuTouPower'
const REPO_NAME = 'omni_pot_release'

interface GithubReleaseAsset {
    name: string
    browser_download_url: string
    size?: number
}

interface GithubRelease {
    tag_name: string
    name: string
    body: string
    html_url: string
    published_at: string
    assets: GithubReleaseAsset[]
}

function is_record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function read_string(value: unknown): string | null {
    return typeof value === 'string' ? value : null
}

function is_github_release_asset(value: unknown): value is GithubReleaseAsset {
    if (!is_record(value)) return false
    return typeof value.name === 'string'
        && typeof value.browser_download_url === 'string'
        && (value.size === undefined || typeof value.size === 'number')
}

function parse_github_release(value: unknown): GithubRelease | null {
    if (!is_record(value)) return null
    const tag_name = read_string(value.tag_name)
    const name = read_string(value.name)
    const body = read_string(value.body)
    const html_url = read_string(value.html_url)
    const published_at = read_string(value.published_at)
    if (tag_name === null || name === null || body === null || html_url === null || published_at === null) return null
    const assets = Array.isArray(value.assets) ? value.assets.filter(is_github_release_asset) : []
    return { tag_name, name, body, html_url, published_at, assets }
}

export default function UpdaterWindow(): React.ReactElement {
    const { t } = useTranslation()
    const [release, setRelease] = useState<ReleaseInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [download_progress, setDownloadProgress] = useState<DownloadProgress | null>(null)
    const [download_error, setDownloadError] = useState<string | null>(null)
    const [downloaded_path, setDownloadedPath] = useState<string | null>(null)
    const [downloading, setDownloading] = useState(false)
    const [currentVersion, setCurrentVersion] = useState('')
    const currentVersionRef = useRef(currentVersion)
    currentVersionRef.current = currentVersion
    const main_release_received = useRef(false)

    useEffect(() => {
        const cleanup = window.electronAPI.update.onRelease((release_info) => {
            main_release_received.current = true
            setRelease(release_info)
            setCurrentVersion(release_info.current_version)
            setError(null)
            setLoading(false)
        })
        window.electronAPI.getVersion().then(setCurrentVersion).catch(() => {})
        window.electronAPI.ready('updater')
        return cleanup
    }, [])

    useEffect(() => {
        const cleanup = window.electronAPI.update.onDownloadProgress((progress) => {
            setDownloadProgress(progress)
        })
        return cleanup
    }, [])

    useEffect(() => {
        const fetch_latest = async () => {
            try {
                const resp = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
                    headers: { 'User-Agent': 'omni_pot-updater' }
                })
                if (!resp.ok) throw new Error(`HTTP ${String(resp.status)}`)
                const data: unknown = await resp.json()
                const latest_release = parse_github_release(data)
                if (latest_release === null) throw new Error('Invalid GitHub release response')
                if (main_release_received.current) return
                setRelease({
                    version: latest_release.tag_name.replace(/^v/, ''),
                    current_version: currentVersionRef.current,
                    name: latest_release.name,
                    body: latest_release.body,
                    html_url: latest_release.html_url,
                    published_at: latest_release.published_at,
                    assets: latest_release.assets.map((asset) => ({
                        name: asset.name,
                        url: asset.browser_download_url,
                        size: asset.size
                    }))
                })
            } catch (err) {
                if (!main_release_received.current) setError(String(err))
            } finally {
                if (!main_release_received.current) setLoading(false)
            }
        }
        fetch_latest().catch(console.error)
    }, [])

    const handleClose = useCallback(() => { window.electronAPI.window.close().catch(console.error) }, [])
    const handleDownloadAndInstall = useCallback(() => {
        const asset = release?.assets[0]
        if (!asset || downloading) return
        setDownloading(true)
        setDownloadError(null)
        setDownloadedPath(null)
        setDownloadProgress({ downloaded: 0, total: asset.size ?? 0, percent: 0 })
        window.electronAPI.update.downloadAndInstall(asset)
            .then((result) => {
                if (result.success) {
                    setDownloadedPath(result.path ?? asset.name)
                    setDownloadProgress((progress) => progress ? { ...progress, percent: 100 } : { downloaded: asset.size ?? 0, total: asset.size ?? 0, percent: 100 })
                } else {
                    setDownloadError(result.error ?? t('download_failed', { defaultValue: '下载失败' }))
                }
            })
            .catch((err: unknown) => { setDownloadError(String(err)) })
            .finally(() => { setDownloading(false) })
    }, [downloading, release, t])

    const format_size = (size?: number): string | null => {
        if (size === undefined || size < 0) return null
        if (size < 1024) return `${String(size)} B`
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
        return `${(size / 1024 / 1024).toFixed(1)} MB`
    }

    const format_changelog = (body: string): React.ReactNode[] => {
        return body.split('\n').map((line, i) => {
            const trimmed = line.trim()
            if (!trimmed) return <br key={i} />
            // Bold text
            let formatted: React.ReactNode = trimmed.replace(/\*\*(.+?)\*\*/g, '$1')
            if (typeof formatted === 'string') {
                // Links: [text](url)
                const link_parts: React.ReactNode[] = []
                const remaining = formatted
                const link_re = /\[([^\]]+)\]\(([^)]+)\)/g
                let last = 0
                let match = link_re.exec(remaining)
                while (match) {
                    if (match.index > last) link_parts.push(remaining.slice(last, match.index))
                    link_parts.push(<a key={`${String(i)}-link-${String(link_parts.length)}`} href={match[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)' }}>{match[1]}</a>)
                    last = link_re.lastIndex
                    match = link_re.exec(remaining)
                }
                if (last < remaining.length) link_parts.push(remaining.slice(last))
                if (link_parts.length > 1) formatted = <>{link_parts}</>
            }
            // Headers
            if (trimmed.startsWith('### ')) return <div key={i} style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8, marginBottom: 2 }}>{formatted}</div>
            if (trimmed.startsWith('## ')) return <div key={i} style={{ fontSize: 13, fontWeight: 600, marginTop: 10, marginBottom: 4 }}>{trimmed.slice(3)}</div>
            if (trimmed.startsWith('# ')) return <div key={i} style={{ fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>{trimmed.slice(2)}</div>
            // List items
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return <div key={i} style={{ paddingLeft: 14, position: 'relative' }}><span style={{ position: 'absolute', left: 0 }}>·</span>{formatted}</div>
            return <div key={i}>{formatted}</div>
        })
    }

    const format_date = (dateStr: string): string => {
        try {
            const d = new Date(dateStr)
            return d.toISOString().slice(0, 10)
        } catch {
            return dateStr
        }
    }

    const release_size = release ? format_size(release.assets[0]?.size) : null

    return (
        <div className="op-window" style={{ width: 600, height: 420 }}>
            {/* Titlebar */}
            <div className="op-titlebar">
                <div className="op-wordmark" data-testid="titlebar-wordmark">
                    Omni Pot
                </div>
                <span className="op-mode">{t('updater.title')}</span>
                <div style={{ flex: 1 }} />
                <button className="ic-btn" title={t('close')} onClick={handleClose}>
                    <Icons.Close size={14} />
                </button>
            </div>

            {/* Content */}
            <div style={{ padding: '8px 16px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'auto' }}>
                {/* Loading state */}
                {loading && (
                    <div data-testid="updater-progress" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                        <Icons.Cycle size={24} style={{ color: 'var(--text-mute)', animation: 'spin 1s linear infinite' }} />
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="card" style={{ padding: 14 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <Icons.Info size={16} style={{ color: 'var(--danger)', marginTop: 1, flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>
                                    {t('update_check_failed', { defaultValue: '检查更新失败' })}
                                </div>
                                <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>{error}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Release info */}
                {release && !loading && (
                    <>
                        {/* Header with brand tile */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                                className="svc-tile"
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    background: 'var(--brand-primary)',
                                    color: '#fff',
                                    borderColor: 'transparent',
                                    fontSize: 14,
                                    fontWeight: 700,
                                }}
                            >
                                op
                            </div>
                            <div className="stack">
                                <div style={{ fontSize: 15, fontWeight: 600 }}>
                                    {t('update_available', { defaultValue: '有新版本可用' })}
                                </div>
                                <div className="hint mono" data-testid="updater-release-meta">
                                    {release.current_version} → {release.version}
                                    {release.published_at && <> · {format_date(release.published_at)}</>}
                                    {release_size && <> · {release_size}</>}
                                </div>
                            </div>
                        </div>

                        {/* Changelog card */}
                        {release.body && (
                            <div className="card" data-testid="updater-changelog" style={{ flex: 1, overflow: 'auto', padding: 14 }}>
                                <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                                    {t('changelog')}
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-dim)' }}>
                                    {format_changelog(release.body)}
                                </div>
                            </div>
                        )}

                        {/* Download links */}
                        {release.assets.length > 0 && (
                            <div className="card" style={{ padding: 10 }}>
                                <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, padding: '0 4px' }}>
                                    {t('downloads', { defaultValue: '下载' })}
                                </div>
                                {release.assets.map((asset) => (
                                    <a
                                        key={asset.name}
                                        href={asset.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '6px 8px',
                                            borderRadius: 6,
                                            fontSize: 12.5,
                                            color: 'var(--brand-primary)',
                                            textDecoration: 'none',
                                            transition: 'background .12s',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-sunk)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <Icons.Export size={13} />
                                        <span style={{ flex: 1 }}>{asset.name}</span>
                                    </a>
                                ))}
                            </div>
                        )}

                        {/* Download status */}
                        {(download_progress || download_error || downloaded_path) && (
                            <div className="card" data-testid="updater-progress" style={{ padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 8 }}>
                                    <span>
                                        {download_error
                                            ? t('download_failed', { defaultValue: '下载失败' })
                                            : downloaded_path
                                                ? t('download_complete', { defaultValue: '下载完成' })
                                                : t('downloading', { defaultValue: '正在下载' })}
                                    </span>
                                    {download_progress && <span className="mono" data-testid="updater-progress-percent">{download_progress.percent}%</span>}
                                </div>
                                {download_progress && (
                                    <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-sunk)', overflow: 'hidden' }}>
                                        <div data-testid="updater-progress-bar" style={{ width: `${String(download_progress.percent)}%`, height: '100%', background: 'var(--brand-primary)', transition: 'width .12s' }} />
                                    </div>
                                )}
                                {download_progress && download_progress.total > 0 && (
                                    <div className="hint mono" style={{ marginTop: 6 }}>
                                        {format_size(download_progress.downloaded)} / {format_size(download_progress.total)}
                                    </div>
                                )}
                                {download_error && <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--danger)' }}>{download_error}</div>}
                                {downloaded_path && <div className="hint mono" style={{ marginTop: 6 }}>{downloaded_path}</div>}
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn" data-testid="updater-later" onClick={handleClose} disabled={downloading}>
                                {t('update_later', { defaultValue: '稍后提醒' })}
                            </button>
                            <button className="btn primary" data-testid="updater-confirm" onClick={handleDownloadAndInstall} disabled={downloading || release.assets.length === 0}>
                                {downloading
                                    ? t('downloading', { defaultValue: '正在下载' })
                                    : downloaded_path
                                        ? t('download_complete', { defaultValue: '下载完成' })
                                        : t('update_now', { defaultValue: '立即更新' })}
                            </button>
                        </div>
                    </>
                )}

                {/* No update available */}
                {!loading && !error && !release && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8 }}>
                        <Icons.Check size={32} style={{ color: 'var(--brand-primary)' }} />
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{t('up_to_date', { defaultValue: '已是最新版本' })}</div>
                        <div className="hint mono">v{currentVersion}</div>
                    </div>
                )}
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}
