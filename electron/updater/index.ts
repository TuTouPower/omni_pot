import { app, dialog } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { getConfig } from '../config/store'

const REPO_OWNER = 'TuTouPower'
const REPO_NAME = 'omni_pot'

interface GitHubRelease {
    tag_name: string
    name: string
    body: string
    html_url: string
    assets: Array<{ name: string; browser_download_url: string }>
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

export async function checkForUpdate(manager: WindowManager, silent = true): Promise<void> {
    const enabled = getConfig('check_update')
    if (!enabled) return

    try {
        const resp = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
            headers: { 'User-Agent': 'omni_pot-updater' }
        })
        if (!resp.ok) {
            if (!silent) dialog.showErrorBox('Update Check Failed', `HTTP ${resp.status}`)
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
                })
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
            assets: release.assets.map((a) => ({ name: a.name, url: a.browser_download_url }))
        })
    } catch (err) {
        if (!silent) {
            dialog.showErrorBox('Update Check Failed', String(err))
        }
    }
}
