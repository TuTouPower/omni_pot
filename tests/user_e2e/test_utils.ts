import { CdpClient, findTranslateTarget, CDP_PORT } from './cdp_helper'
import { mkdirSync } from 'fs'
import { join } from 'path'

export const SCREENSHOT_DIR = join(__dirname, '__screenshots__')

let _client: CdpClient | null = null

export async function getClient(): Promise<CdpClient> {
    if (_client) return _client
    const target = await findTranslateTarget(CDP_PORT)
    _client = await CdpClient.connect(target.wsUrl)
    return _client
}

export function cleanupClient(): void {
    _client?.close()
    _client = null
}

export async function clearTextarea(): Promise<void> {
    const c = await getClient()
    await c.evaluate('document.querySelector("textarea").value = ""')
    await c.evaluate('document.querySelector("textarea").focus()')
}

export async function getTextareaValue(): Promise<string> {
    const c = await getClient()
    return (await c.evaluate('document.querySelector("textarea").value')) as string
}

mkdirSync(SCREENSHOT_DIR, { recursive: true })
