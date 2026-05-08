import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Tesseract from 'tesseract.js'
import { resolve } from 'path'
import { CdpClient, findAllTargets } from './helpers/cdp_helper'
import { ensureBuilt, startElectron, stopElectron, type ElectronInstance } from './helpers/electron_launcher'

const TESSERACT_LANG_PATH = resolve(__dirname, '../../data/tesseract')
const TRANSLATE_RESULT_TIMEOUT = 45000

// ── Types ──

interface CPContext {
    client: CdpClient
    httpPort: number
    cdpPort: number
}

interface CPResult {
    description: string
    sourceText: string
    producesHistory: boolean
}

// ── Context-aware HTTP helpers ──

async function httpPost(httpPort: number, path: string, body?: string): Promise<string> {
    const http = await import('http')
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: httpPort,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(body ? { 'Content-Length': String(body.length) } : {})
            }
        }, (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk: Buffer) => chunks.push(chunk))
            res.on('end', () => resolve(Buffer.concat(chunks).toString()))
        })
        req.on('error', reject)
        if (body) req.write(body)
        req.end()
    })
}

async function httpGet(httpPort: number, path: string): Promise<string> {
    const http = await import('http')
    return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${httpPort}${path}`, (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk: Buffer) => chunks.push(chunk))
            res.on('end', () => resolve(Buffer.concat(chunks).toString()))
        }).on('error', reject)
    })
}

// ── Context-aware helpers ──

async function ctx_readConfig(ctx: CPContext, key: string): Promise<unknown> {
    return ctx.client.evaluate(`window.electronAPI.config.get('${key}')`)
}

async function ctx_writeConfig(ctx: CPContext, key: string, value: unknown): Promise<void> {
    await ctx.client.evaluate(`window.electronAPI.config.set('${key}', ${JSON.stringify(value)})`)
}

async function ctx_clearTextarea(ctx: CPContext): Promise<void> {
    const c = ctx.client
    await c.evaluate('document.querySelector("textarea")?.focus()')
    await c.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'a', code: 'KeyA',
        windowsVirtualKeyCode: 65, modifiers: 2
    })
    await c.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'a', code: 'KeyA',
        windowsVirtualKeyCode: 65, modifiers: 2
    })
    await c.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Delete', code: 'Delete',
        windowsVirtualKeyCode: 46
    })
    await c.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Delete', code: 'Delete',
        windowsVirtualKeyCode: 46
    })
}

async function ctx_getTextareaValue(ctx: CPContext): Promise<string> {
    return (await ctx.client.evaluate('document.querySelector("textarea")?.value ?? ""')) as string
}

async function ctx_waitForSourceText(ctx: CPContext, expected: string, timeoutMs = 5000): Promise<void> {
    let lastVal = ''
    await ctx.client.waitFor(async () => {
        lastVal = await ctx_getTextareaValue(ctx)
        return lastVal === expected
    }, timeoutMs).catch(() => {
        throw new Error(`waitForSourceText: expected ${JSON.stringify(expected)}, got ${JSON.stringify(lastVal)}`)
    })
}

async function ctx_waitForSelector(ctx: CPContext, selector: string, timeoutMs = 10000): Promise<void> {
    await ctx.client.waitFor(async () => {
        const count = await ctx.client.evaluate(`document.querySelectorAll("${selector}").length`) as number
        return count > 0
    }, timeoutMs)
}

async function ctx_triggerSelectionTranslate(ctx: CPContext, text: string): Promise<{ success: boolean; method?: string; reason?: string }> {
    const body = JSON.stringify({ text })
    const raw = await httpPost(ctx.httpPort, '/trigger-selection', body)
    try { return JSON.parse(raw) } catch { return { success: false } }
}

async function ctx_triggerDictLookup(ctx: CPContext, text: string): Promise<{ success: boolean; error?: string }> {
    const raw = await httpPost(ctx.httpPort, '/trigger-dict', JSON.stringify({ text }))
    try { return JSON.parse(raw) } catch { return { success: false } }
}

async function ctx_triggerClipboardText(ctx: CPContext, text: string): Promise<{ success: boolean; error?: string }> {
    const raw = await httpPost(ctx.httpPort, '/trigger-clipboard', JSON.stringify({ text }))
    try { return JSON.parse(raw) } catch { return { success: false } }
}

async function ctx_triggerClipboardTranslate(ctx: CPContext, text: string): Promise<{ success: boolean; error?: string }> {
    const raw = await httpPost(ctx.httpPort, '/trigger-clipboard-translate', JSON.stringify({ text }))
    try { return JSON.parse(raw) } catch { return { success: false } }
}

async function ctx_triggerTranslateViaApi(ctx: CPContext, text: string): Promise<void> {
    const http = await import('http')
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: ctx.httpPort,
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

async function ctx_captureClockImage(ctx: CPContext): Promise<string> {
    const raw = await httpGet(ctx.httpPort, '/capture-clock')
    const data = JSON.parse(raw)
    if (data.success) return data.image
    throw new Error(data.error ?? 'capture failed')
}

// ── Service result helpers ──

async function ctx_readServiceResult(ctx: CPContext, instanceKey: string): Promise<string | null> {
    return ctx.client.evaluate(`
        (() => {
            const card = document.querySelector('[data-result-key="${instanceKey}"]')
            if (!card) return null
            const ta = card.querySelector('textarea')
            if (ta && ta.value) return ta.value
            const p = card.querySelector('p')
            if (p && p.textContent && !p.textContent.includes('failed')) return p.textContent
            return null
        })()
    `) as Promise<string | null>
}

async function ctx_waitForServiceResult(ctx: CPContext, instanceKey: string, timeoutMs = TRANSLATE_RESULT_TIMEOUT): Promise<string> {
    let result: string | null = null
    await ctx.client.waitFor(async () => {
        result = await ctx_readServiceResult(ctx, instanceKey)
        return result !== null && result.length > 0
    }, timeoutMs)
    return result ?? ''
}

async function ctx_waitForAllServiceResults(ctx: CPContext, serviceList: string[], timeoutMs = TRANSLATE_RESULT_TIMEOUT): Promise<Record<string, string>> {
    await new Promise(r => setTimeout(r, 300))
    const results: Record<string, string> = {}
    const deadline = Date.now() + timeoutMs
    for (const key of serviceList) {
        const remaining = deadline - Date.now()
        if (remaining <= 0) throw new Error(`Timed out waiting for ${key} (${Object.keys(results).length}/${serviceList.length} done)`)
        results[key] = await ctx_waitForServiceResult(ctx, key, remaining)
    }
    return results
}

// ── History helpers ──

async function ctx_waitForHistoryCount(ctx: CPContext, expectedMin: number, timeoutMs = 8000): Promise<number> {
    let count = 0
    await ctx.client.waitFor(async () => {
        count = await ctx.client.evaluate('window.electronAPI.history.count()') as number
        return count >= expectedMin
    }, timeoutMs)
    return count
}

async function ctx_getHistoryList(ctx: CPContext, page: number, pageSize: number): Promise<Array<{ source_text: string }>> {
    return ctx.client.evaluate(`window.electronAPI.history.list(${page}, ${pageSize})`) as Promise<Array<{ source_text: string }>>
}

async function ctx_clearHistory(ctx: CPContext): Promise<void> {
    await ctx.client.evaluate('window.electronAPI.history.clear()')
}

// ── OCR helpers ──

function parseTimeFromOcr(text: string): { hours: number; minutes: number } | null {
    const match = text.match(/(\d{1,2})\s*[:：]\s*(\d{2})/)
    if (!match) return null
    return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) }
}

function isTimeClose(h1: number, m1: number, h2: number, m2: number, toleranceMinutes = 2): boolean {
    const t1 = h1 * 60 + m1
    const t2 = h2 * 60 + m2
    return Math.abs(t1 - t2) <= toleranceMinutes
}

// ── Shuffle ──

function shuffle<T>(array: T[]): T[] {
    const a = [...array]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

// ── CP Executor Functions ──

async function executeCP1(ctx: CPContext): Promise<CPResult> {
    const text = `cp1 selection ${Date.now()}`
    const response = await ctx_triggerSelectionTranslate(ctx, text)
    expect(response.success).toBe(true)
    await ctx_waitForSourceText(ctx, text, 8000)

    const serviceList = await ctx_readConfig(ctx, 'translate_service_list') as string[]
    const results = await ctx_waitForAllServiceResults(ctx, serviceList)
    for (const r of Object.values(results)) {
        expect(r.length).toBeGreaterThan(0)
    }
    return { description: 'CP1 Selection Translate', sourceText: text, producesHistory: true }
}

async function executeCP2(ctx: CPContext): Promise<CPResult> {
    const text = `cp2 input ${Date.now()}`
    await ctx_clearTextarea(ctx)
    await ctx.client.insertText(text)
    await ctx.client.pressEnter()

    await ctx_waitForSourceText(ctx, text, 5000)
    const serviceList = await ctx_readConfig(ctx, 'translate_service_list') as string[]
    const results = await ctx_waitForAllServiceResults(ctx, serviceList)
    for (const r of Object.values(results)) {
        expect(r.length).toBeGreaterThan(0)
    }
    return { description: 'CP2 Input Translate', sourceText: text, producesHistory: true }
}

async function executeCP3(ctx: CPContext): Promise<CPResult> {
    // Retry screen capture + OCR up to 3 times (DXGI capture can fail under load)
    let imageBase64 = ''
    let ocrText = ''
    let parsed: { hours: number; minutes: number } | null = null

    for (let attempt = 1; attempt <= 3; attempt++) {
        const beforeTime = new Date()

        imageBase64 = await ctx_captureClockImage(ctx)
        if (imageBase64.length === 0) {
            console.log(`[CP3] Attempt ${attempt}: empty image, retrying...`)
            await new Promise(r => setTimeout(r, 1000))
            continue
        }

        const worker = await Tesseract.createWorker('eng', 1, { langPath: TESSERACT_LANG_PATH, cachePath: TESSERACT_LANG_PATH })
        const result = await worker.recognize(`data:image/png;base64,${imageBase64}`)
        await worker.terminate()
        ocrText = result.data.text.trim()
        console.log(`[CP3] Attempt ${attempt} OCR text: "${ocrText}"`)

        parsed = parseTimeFromOcr(ocrText)
        if (!parsed) {
            console.log(`[CP3] Attempt ${attempt}: no time pattern found, retrying...`)
            await new Promise(r => setTimeout(r, 1000))
            continue
        }

        const nowHours = beforeTime.getHours()
        const nowMinutes = beforeTime.getMinutes()
        if (isTimeClose(parsed.hours, parsed.minutes, nowHours, nowMinutes, 2)) {
            console.log(`[CP3] Attempt ${attempt}: time match ${parsed.hours}:${String(parsed.minutes).padStart(2, '0')}`)
            break
        }

        console.log(`[CP3] Attempt ${attempt}: time mismatch (got ${parsed.hours}:${parsed.minutes}, expected ~${nowHours}:${nowMinutes}), retrying...`)
        parsed = null
        await new Promise(r => setTimeout(r, 1000))
    }

    expect(imageBase64.length).toBeGreaterThan(0)
    expect(ocrText.length).toBeGreaterThan(0)
    expect(parsed).not.toBeNull()

    await ctx.client.evaluate(`
        window.electronAPI.ocr.openRecognize('${imageBase64}', ${JSON.stringify(ocrText)})
    `)

    await new Promise(r => setTimeout(r, 2000))
    const targets = await findAllTargets(ctx.cdpPort)
    const recognizeTarget = targets.find(t => t.url.includes('recognize'))
    expect(recognizeTarget).toBeDefined()

    const recognizeClient = await CdpClient.connect(recognizeTarget!.webSocketDebuggerUrl)
    const displayedText = await recognizeClient.evaluate(
        `document.querySelector('pre')?.textContent ?? document.querySelector('textarea')?.value ?? ''`
    ) as string
    expect(displayedText.length).toBeGreaterThan(0)
    recognizeClient.close()

    return { description: 'CP3 OCR Recognize (taskbar clock)', sourceText: ocrText, producesHistory: false }
}

async function executeCP4(ctx: CPContext): Promise<CPResult> {
    const text = `cp4 ocr translate ${Date.now()}`
    await ctx.client.evaluate(`
        window.electronAPI.ocr.sendToTranslate(${JSON.stringify(text)})
    `)
    await ctx_waitForSourceText(ctx, text, 8000)

    const serviceList = await ctx_readConfig(ctx, 'translate_service_list') as string[]
    const results = await ctx_waitForAllServiceResults(ctx, serviceList)
    for (const r of Object.values(results)) {
        expect(r.length).toBeGreaterThan(0)
    }
    return { description: 'CP4 OCR Translate', sourceText: text, producesHistory: true }
}

async function executeCP5(ctx: CPContext): Promise<CPResult> {
    await ctx_triggerDictLookup(ctx, 'hello')

    await new Promise(r => setTimeout(r, 2000))
    const targets = await findAllTargets(ctx.cdpPort)
    const dictTarget = targets.find(t => t.url.includes('dict'))
    expect(dictTarget).toBeDefined()

    const dictClient = await CdpClient.connect(dictTarget!.webSocketDebuggerUrl)
    await dictClient.waitFor(async () => {
        const count = await dictClient.evaluate(
            `document.querySelectorAll('[data-result-key]').length`
        ) as number
        return count > 0
    }, 30000)

    const hasContent = await dictClient.evaluate(`
        (() => {
            const cards = document.querySelectorAll('[data-result-key]')
            for (const card of cards) {
                const text = card.textContent ?? ''
                if (text.length > 10) return true
            }
            return false
        })()
    `) as boolean
    expect(hasContent).toBe(true)
    dictClient.close()

    return { description: 'CP5 Dict Lookup', sourceText: 'hello', producesHistory: false }
}

async function executeCP6(ctx: CPContext): Promise<CPResult> {
    const text = `cp6 clipboard ${Date.now()}`
    await ctx_triggerClipboardText(ctx, text)
    await ctx_triggerClipboardTranslate(ctx, text)
    await ctx_waitForSourceText(ctx, text, 8000)

    const serviceList = await ctx_readConfig(ctx, 'translate_service_list') as string[]
    const results = await ctx_waitForAllServiceResults(ctx, serviceList)
    for (const r of Object.values(results)) {
        expect(r.length).toBeGreaterThan(0)
    }
    return { description: 'CP6 Clipboard Translate', sourceText: text, producesHistory: true }
}

// ── Instance lifecycle for parallel mode ──

async function setupInstance(): Promise<{ ctx: CPContext; instance: ElectronInstance }> {
    const instance = await startElectron()
    const ctx: CPContext = {
        client: instance.translateClient,
        httpPort: instance.httpPort,
        cdpPort: instance.cdpPort
    }
    await ctx_writeConfig(ctx, 'clipboard_monitor', true)
    await ctx_writeConfig(ctx, 'recognize_service_list', ['tesseract@default'])
    await ctx_writeConfig(ctx, 'history_disable', false)

    await ctx_waitForSelector(ctx, 'textarea', 15000)
    await ctx_clearHistory(ctx)
    await new Promise(r => setTimeout(r, 500))
    return { ctx, instance }
}

// ── Main Test ──

describe('CP1-CP6 Combined Integration Test', () => {
    const isParallel = !!process.env.CP_PARALLEL
    let serialInstance: ElectronInstance
    let serialCtx: CPContext
    let translateServiceList: string[] = []
    const cpResults: CPResult[] = []
    const executionOrder: string[] = []

    beforeAll(async () => {
        await ensureBuilt()

        if (!isParallel) {
            serialInstance = await startElectron()
            globalThis.__e2e_instance = serialInstance
            serialCtx = {
                client: serialInstance.translateClient,
                httpPort: serialInstance.httpPort,
                cdpPort: serialInstance.cdpPort
            }

            await ctx_writeConfig(serialCtx, 'clipboard_monitor', true)
            await ctx_writeConfig(serialCtx, 'recognize_service_list', ['tesseract@default'])
            await ctx_writeConfig(serialCtx, 'history_disable', false)

            await ctx_waitForSelector(serialCtx, 'textarea', 15000)
            await ctx_clearHistory(serialCtx)
            await new Promise(r => setTimeout(r, 500))

            translateServiceList = await ctx_readConfig(serialCtx, 'translate_service_list') as string[]
            expect(translateServiceList.length).toBeGreaterThan(0)
        }
    }, 120000)

    afterAll(async () => {
        if (!isParallel && serialInstance) {
            await stopElectron(serialInstance)
        }
    })

    it('executes specified critical paths', async () => {
        const allExecutors: Array<{ name: string; fn: (ctx: CPContext) => Promise<CPResult> }> = [
            { name: 'CP1', fn: executeCP1 },
            { name: 'CP2', fn: executeCP2 },
            { name: 'CP3', fn: executeCP3 },
            { name: 'CP4', fn: executeCP4 },
            { name: 'CP5', fn: executeCP5 },
            { name: 'CP6', fn: executeCP6 }
        ]

        // Filter by CP_FILTER env var (e.g. CP_FILTER=1,3,5 or CP_FILTER=3)
        const filter = process.env.CP_FILTER
        const executors = filter
            ? allExecutors.filter(e => {
                const nums = filter.split(',').map(s => s.trim())
                return nums.some(n => e.name === `CP${n}`)
            })
            : allExecutors

        if (executors.length === 0) {
            console.log('[CP] No CPs matched filter, skipping')
            return
        }

        if (isParallel) {
            console.log('[CP] Parallel mode: launching', executors.length, 'instances')

            const settled = await Promise.allSettled(
                executors.map(async ({ name, fn }) => {
                    const { ctx, instance } = await setupInstance()
                    try {
                        console.log(`[CP] Parallel ${name} starting...`)
                        const result = await fn(ctx)
                        console.log(`[CP] Parallel ${name} done. sourceText="${result.sourceText}"`)

                        if (result.producesHistory) {
                            const serviceList = await ctx_readConfig(ctx, 'translate_service_list') as string[]
                            const count = await ctx_waitForHistoryCount(ctx, serviceList.length)
                            expect(count).toBeGreaterThanOrEqual(serviceList.length)
                        }

                        return { name, result }
                    } finally {
                        await stopElectron(instance)
                    }
                })
            )

            for (let i = 0; i < settled.length; i++) {
                const s = settled[i]
                if (s.status === 'fulfilled') {
                    cpResults.push(s.value.result)
                    executionOrder.push(s.value.name)
                } else {
                    console.error(`[CP] Parallel ${executors[i].name} FAILED:`, s.reason)
                    throw s.reason
                }
            }
        } else {
            // Serial mode with random order
            const order = shuffle(executors)
            console.log('[CP] Serial mode, execution order:', order.map(e => e.name).join(' → '))

            for (const { name, fn } of order) {
                console.log(`[CP] Running ${name}...`)

                try {
                    const result = await fn(serialCtx)
                    executionOrder.push(name)
                    cpResults.push(result)
                    console.log(`[CP] ${name} done. sourceText="${result.sourceText}" producesHistory=${result.producesHistory}`)

                    // Verify translate window is still alive after each step
                    const alive = await serialCtx.client.evaluate('document.querySelector("textarea") !== null') as boolean
                    expect(alive).toBe(true)

                    // Brief pause for async history writes to settle
                    await new Promise(r => setTimeout(r, 1000))
                } catch (e) {
                    executionOrder.push(name)
                    console.error(`[CP] ${name} FAILED:`, e)
                    throw e
                }
            }
        }
    }, 600000) // 10 min timeout

    it('history contains entries from all translation CPs (serial only)', async () => {
        if (isParallel) {
            console.log('[CP] Skipping history check in parallel mode (verified per-instance)')
            return
        }

        const historyProducingCPs = cpResults.filter(r => r.producesHistory)
        if (historyProducingCPs.length === 0) return

        const expectedMin = historyProducingCPs.length * translateServiceList.length
        const actualCount = await ctx_waitForHistoryCount(serialCtx, expectedMin)
        expect(actualCount).toBeGreaterThanOrEqual(expectedMin)

        const records = await ctx_getHistoryList(serialCtx, 1, actualCount)
        for (const cp of historyProducingCPs) {
            const found = records.some(r => r.source_text === cp.sourceText)
            expect(found).toBe(true)
        }
    })

    it('translate window is still fully functional after all CPs (serial only)', async () => {
        if (isParallel) {
            console.log('[CP] Skipping functional check in parallel mode (instances stopped)')
            return
        }

        await ctx_clearTextarea(serialCtx)
        await ctx_triggerTranslateViaApi(serialCtx, 'post-test verification')
        await ctx_waitForSourceText(serialCtx, 'post-test verification', 5000)

        const serviceList = await ctx_readConfig(serialCtx, 'translate_service_list') as string[]
        const results = await ctx_waitForAllServiceResults(serialCtx, serviceList)
        for (const r of Object.values(results)) {
            expect(r.length).toBeGreaterThan(0)
        }
    }, 60000)

    it('printed execution order for reproducibility', () => {
        console.log('[CP] Mode:', isParallel ? 'PARALLEL' : 'SERIAL')
        console.log('[CP] Final execution order:', executionOrder.join(' → '))
        console.log('[CP] Results:', cpResults.map(r => `${r.description}: "${r.sourceText}"`))
        expect(executionOrder.length).toBe(cpResults.length)
    })
})

// Extend globalThis for instance sharing
declare global {
    // eslint-disable-next-line no-var
    var __e2e_instance: ElectronInstance
}
