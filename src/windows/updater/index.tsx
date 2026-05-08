import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Button, Spinner } from '@heroui/react'
import { AiFillCloseCircle } from 'react-icons/ai'
import { MdOpenInNew } from 'react-icons/md'

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

    return (
        <div className="flex flex-col h-screen p-4 gap-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold">{t('update_available')}</h2>
                <Button isIconOnly size="sm" variant="light" onPress={handleClose}>
                    <AiFillCloseCircle className="text-lg" />
                </Button>
            </div>

            {loading && (
                <div className="flex justify-center py-8">
                    <Spinner size="lg" color="primary" />
                </div>
            )}

            {error && (
                <Card variant="bordered">
                    <Card.Content className="p-4">
                        <p className="text-danger text-sm">{t('update_check_failed')}: {error}</p>
                    </Card.Content>
                </Card>
            )}

            {release && (
                <>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-default-400">{t('current')}: v{release.current_version}</span>
                        <span className="text-sm">→</span>
                        <span className="text-sm font-bold text-primary">{t('latest')}: v{release.version}</span>
                    </div>

                    <Button color="primary" onPress={handleOpenRelease} startContent={<MdOpenInNew />}>
                        {t('open_release_page')}
                    </Button>

                    {release.body && (
                        <Card variant="bordered" className="flex-1 overflow-hidden">
                            <Card.Header className="px-3 py-2">
                                <span className="text-sm font-semibold">{release.name ?? `v${release.version}`}</span>
                            </Card.Header>
                            <Card.Content className="px-3 py-2 overflow-y-auto text-sm">
                                <div className="whitespace-pre-wrap">{release.body}</div>
                            </Card.Content>
                        </Card>
                    )}

                    {release.assets.length > 0 && (
                        <div className="text-sm">
                            <p className="font-semibold mb-1">{t('downloads')}:</p>
                            {release.assets.map((asset) => (
                                <a
                                    key={asset.name}
                                    href={asset.url}
                                    className="block text-primary hover:underline truncate"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {asset.name}
                                </a>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
