import { CdpClient, findTranslateTarget, findConfigTarget, findRecognizeTarget, CDP_PORT } from './cdp_helper'

// --- Translate window ---

let _translateClient: CdpClient | null = null

export async function getTranslateClient(): Promise<CdpClient> {
    if (_translateClient) return _translateClient
    const target = await findTranslateTarget(CDP_PORT)
    _translateClient = await CdpClient.connect(target.wsUrl)
    return _translateClient
}

// --- Config window ---

let _configClient: CdpClient | null = null

export async function getConfigClient(): Promise<CdpClient> {
    if (_configClient) return _configClient
    const target = await findConfigTarget(CDP_PORT)
    _configClient = await CdpClient.connect(target.wsUrl)
    return _configClient
}

// --- Recognize window ---

let _recognizeClient: CdpClient | null = null

export async function getRecognizeClient(): Promise<CdpClient> {
    if (_recognizeClient) return _recognizeClient
    const target = await findRecognizeTarget(CDP_PORT)
    _recognizeClient = await CdpClient.connect(target.wsUrl)
    return _recognizeClient
}

// --- Cleanup ---

export function cleanupAllClients(): void {
    _translateClient?.close()
    _translateClient = null
    _configClient?.close()
    _configClient = null
    _recognizeClient?.close()
    _recognizeClient = null
}

// Legacy compat for existing tests
export function cleanupClient(): void {
    cleanupAllClients()
}

// --- Translate helpers ---

export async function clearTextarea(): Promise<void> {
    const c = await getTranslateClient()
    await c.evaluate('document.querySelector("textarea").value = ""')
    await c.evaluate('document.querySelector("textarea").focus()')
}

export async function getTextareaValue(): Promise<string> {
    const c = await getTranslateClient()
    return (await c.evaluate('document.querySelector("textarea").value')) as string
}

/** Read a config key from the translate window's electronAPI */
export async function readConfig(key: string): Promise<unknown> {
    const c = await getTranslateClient()
    return c.evaluate(`window.electronAPI.config.get('${key}')`)
}

/** Write a config key via the translate window's electronAPI */
export async function writeConfig(key: string, value: unknown): Promise<void> {
    const c = await getTranslateClient()
    await c.evaluate(`window.electronAPI.config.set('${key}', ${JSON.stringify(value)})`)
}

/** Trigger translate:from-selection simulation via HTTP API */
export async function triggerTranslateViaApi(text: string): Promise<void> {
    const http = await import('http')
    const port = await readConfig('server_port') as number
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: '/translate',
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' }
        }, (res) => {
            res.resume()
            res.on('end', resolve)
        })
        req.on('error', reject)
        req.write(text)
        req.end()
    })
}

/** Wait until the translate results area has at least N result cards */
export async function waitForResults(minCount: number, timeoutMs = 15000): Promise<void> {
    const c = await getTranslateClient()
    await c.waitFor(
        async () => {
            const count = await c.evaluate(`
                document.querySelectorAll('[data-result-key]').length
            `) as number
            return count >= minCount
        },
        timeoutMs
    )
}

/** Wait until source text in translate window matches expected value */
export async function waitForSourceText(expected: string, timeoutMs = 5000): Promise<void> {
    const c = await getTranslateClient()
    await c.waitFor(
        async () => {
            const val = await getTextareaValue()
            return val === expected
        },
        timeoutMs
    )
}

// Backward compat
export { getTranslateClient as getClient }
