import { session } from 'electron'
import { getConfig } from '../config/store'
import { log } from '../log'

const log_proxy = log.scope('proxy')

export function applyProxy(): void {
    const enabled = getConfig('proxy_enable')
    const host = getConfig('proxy_host') as string
    const port = getConfig('proxy_port') as string

    if (!enabled || !host) {
        session.defaultSession.setProxy({ mode: 'direct' }).catch((err: unknown) => { log_proxy.error(err) })
        return
    }

    const proxy_url = port ? `${host}:${port}` : host
    session.defaultSession.setProxy({
        mode: 'fixed_servers',
        proxyRules: `http=${proxy_url};https=${proxy_url}`
    }).catch((err: unknown) => { log_proxy.error(err) })
}
