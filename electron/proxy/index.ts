import { session } from 'electron'
import { getConfig } from '../config/store'

export function applyProxy(): void {
    const enabled = getConfig('proxy_enable')
    const host = getConfig('proxy_host') as string
    const port = getConfig('proxy_port') as string

    if (!enabled || !host) {
        session.defaultSession.setProxy({ mode: 'direct' })
        return
    }

    const proxy_url = port ? `${host}:${port}` : host
    session.defaultSession.setProxy({
        mode: 'fixed_servers',
        proxyRules: `http=${proxy_url};https=${proxy_url}`
    })
}
