import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../../components/icons'

interface ReleaseAsset {
    name: string
    url: string
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

const REPO_OWNER = 'TuTouPower'
const REPO_NAME = 'omni_pot'

export default function UpdaterWindow(): React.ReactElement {
    const { t } = useTranslation()
    const [release, setRelease] = useState<ReleaseInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        window.electronAPI.ready('updater')
    }, [])

    useEffect(() => {
        const fetch_latest = async () => {
            try {
                const resp = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
                    headers: { 'User-Agent': 'omni_pot-updater' }
                })
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
                const data = await resp.json()
                setRelease({
                    version: data.tag_name.replace(/^v/, ''),
                    current_version: '0.1.0',
                    name: data.name,
                    body: data.body,
                    html_url: data.html_url,
                    published_at: data.published_at,
                    assets: (data.assets ?? []).map((a: { name: string; browser_download_url: string }) => ({
                        name: a.name,
                        url: a.browser_download_url
                    }))
                })
            } catch (err) {
                setError(String(err))
            } finally {
                setLoading(false)
            }
        }
        fetch_latest()
    }, [])

    const handleClose = useCallback(() => window.electronAPI.window.close(), [])
    const handleOpenRelease = useCallback(() => {
        if (release?.html_url) window.open(release.html_url, '_blank')
    }, [release])

    const format_size = (assets: ReleaseAsset[]): string => {
        // Approximate — we don't have size from the API without extra calls
        return ''
    }

    const format_date = (dateStr: string): string => {
        try {
            const d = new Date(dateStr)
            return d.toISOString().slice(0, 10)
        } catch {
            return dateStr
        }
    }

    return (
        <div className="op-window" style={{ width: 600, height: 420 }}>
            {/* Titlebar */}
            <div className="op-titlebar">
                <button
                    className="ic-btn"
                    title="置顶"
                    style={{ color: 'var(--text-mute)' }}
                >
                    <Icons.Pin size={14} />
                </button>
                <div className="op-wordmark" style={{ marginLeft: 2 }}>
                    <span className="dot" style={{ background: 'var(--brand-primary)' }} />
                    omni_pot
                </div>
                <span className="op-mode">· 更新</span>
                <div style={{ flex: 1 }} />
                <button className="ic-btn" title="关闭" onClick={handleClose}>
                    <Icons.Close size={14} />
                </button>
            </div>

            {/* Content */}
            <div style={{ padding: '8px 16px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'auto' }}>
                {/* Loading state */}
                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
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
                                    {t('update_check_failed') || '检查更新失败'}
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
                                    {t('update_available') || '有新版本可用'}
                                </div>
                                <div className="hint mono">
                                    {release.current_version} → {release.version}
                                    {release.published_at && <> · {format_date(release.published_at)}</>}
                                </div>
                            </div>
                        </div>

                        {/* Changelog card */}
                        {release.body && (
                            <div className="card" style={{ flex: 1, overflow: 'auto', padding: 14 }}>
                                <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                                    更新日志
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>
                                    {release.body}
                                </div>
                            </div>
                        )}

                        {/* Download links */}
                        {release.assets.length > 0 && (
                            <div className="card" style={{ padding: 10 }}>
                                <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, padding: '0 4px' }}>
                                    下载链接
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

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={handleClose}>
                                {t('update_later') || '稍后提醒'}
                            </button>
                            <button className="btn primary" onClick={handleOpenRelease}>
                                {t('open_release_page') || '查看详情'}
                            </button>
                        </div>
                    </>
                )}

                {/* No update available */}
                {!loading && !error && !release && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8 }}>
                        <Icons.Check size={32} style={{ color: 'var(--brand-primary)' }} />
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{t('up_to_date') || '已是最新版本'}</div>
                        <div className="hint mono">v{'0.1.0'}</div>
                    </div>
                )}
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}
