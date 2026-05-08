import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Tesseract from 'tesseract.js'
import { resolve } from 'path'
import {
    init, cleanup, getTranslateClient,
    clearTextarea, getTextareaValue,
    triggerSelectionTranslate, triggerDictLookup, triggerClipboardText,
    triggerTranslateViaApi, triggerClipboardTranslate, captureClockImage,
    waitForSourceText, waitForSelector,
    readConfig, writeConfig
} from './helpers/test_utils'
import { CdpClient, findAllTargets } from './helpers/cdp_helper'
import { ensureBuilt, startElectron, stopElectron, type ElectronInstance } from './helpers/electron_launcher'

const TESSERACT_LANG_PATH = resolve(__dirname, '../../data/tesseract')

/**
 * CP1-CP6 Combined Integration Test (Random Order)
 *
 * All 6 critical paths executed in random order, one Electron instance.
 * Verifies intermediate state after each CP, and final History correctness.
 * All services are real — no mocks.
 */

const TRANSLATE_RESULT_TIMEOUT = 45000

// ── Helpers ──

interface CPResult {
    description: string
    sourceText: string
    producesHistory: boolean
}

/** Parse hours and minutes from OCR text */
function parseTimeFromOcr(text: string): { hours: number; minutes: number } | null {
    const match = text.match(/(\d{1,2})\s*[:：]\s*(\d{2})/)
    if (!match) return null
    return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) }
}

/** Check if two times are within tolerance minutes of each other */
function isTimeClose(h1: number, m1: number, h2: number, m2: number, toleranceMinutes = 2): boolean {
    const t1 = h1 * 60 + m1
    const t2 = h2 * 60 + m2
    return Math.abs(t1 - t2) <= toleranceMinutes
}

/** Read result text from a specific service card */
async function readServiceResult(instanceKey: string): Promise<string | null> {
    const c = getTranslateClient()
    const result = await c.evaluate(`
        (() => {
            const card = document.querySelector('[data-result-key="${instanceKey}"]')
            if (!card) return null
            const ta = card.querySelector('textarea')
            if (ta && ta.value) return ta.value
            const p = card.querySelector('p')
            if (p && p.textContent && !p.textContent.includes('failed')) return p.textContent
            return null
        })()
    `)
    return result as string | null
}

/** Wait until a service card has non-empty result text */
async function waitForServiceResult(instanceKey: string, timeoutMs = TRANSLATE_RESULT_TIMEOUT): Promise<string> {
    const c = getTranslateClient()
    let result: string | null = null
    await c.waitFor(async () => {
        result = await readServiceResult(instanceKey)
        return result !== null && result.length > 0
    }, timeoutMs)
    return result ?? ''
}

/** Wait for ALL translate services to return non-empty results */
async function waitForAllServiceResults(
    serviceList: string[],
    timeoutMs = TRANSLATE_RESULT_TIMEOUT
): Promise<Record<string, string>> {
    await new Promise(r => setTimeout(r, 300))
    const results: Record<string, string> = {}
    const deadline = Date.now() + timeoutMs
    for (const key of serviceList) {
        const remaining = deadline - Date.now()
        if (remaining <= 0) throw new Error(`Timed out waiting for ${key} (${Object.keys(results).length}/${serviceList.length} done)`)
        results[key] = await waitForServiceResult(key, remaining)
    }
    return results
}

/** Get current history count via electronAPI, polling until expected or timeout */
async function waitForHistoryCount(expectedMin: number, timeoutMs = 8000): Promise<number> {
    const c = getTranslateClient()
    const deadline = Date.now() + timeoutMs
    let count = 0
    await c.waitFor(async () => {
        count = await c.evaluate('window.electronAPI.history.count()') as number
        return count >= expectedMin
    }, timeoutMs)
    return count
}

/** Get history records via electronAPI */
async function getHistoryList(page: number, pageSize: number): Promise<Array<{ source_text: string }>> {
    const c = getTranslateClient()
    return c.evaluate(`window.electronAPI.history.list(${page}, ${pageSize})`) as Promise<Array<{ source_text: string }>>
}

/** Clear all history */
async function clearHistory(): Promise<void> {
    const c = getTranslateClient()
    await c.evaluate('window.electronAPI.history.clear()')
}

/** Fisher-Yates shuffle */
function shuffle<T>(array: T[]): T[] {
    const a = [...array]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

// ── CP Executor Functions ──

async function executeCP1(): Promise<CPResult> {
    const text = `cp1 selection ${Date.now()}`
    const response = await triggerSelectionTranslate(text)
    expect(response.success).toBe(true)
    await waitForSourceText(text, 8000)

    const serviceList = await readConfig('translate_service_list') as string[]
    const results = await waitForAllServiceResults(serviceList)
    for (const r of Object.values(results)) {
        expect(r.length).toBeGreaterThan(0)
    }
    return { description: 'CP1 Selection Translate', sourceText: text, producesHistory: true }
}

async function executeCP2(): Promise<CPResult> {
    const text = `cp2 input ${Date.now()}`
    await clearTextarea()
    const client = getTranslateClient()
    await client.insertText(text)
    await client.pressEnter()

    await waitForSourceText(text, 5000)
    const serviceList = await readConfig('translate_service_list') as string[]
    const results = await waitForAllServiceResults(serviceList)
    for (const r of Object.values(results)) {
        expect(r.length).toBeGreaterThan(0)
    }
    return { description: 'CP2 Input Translate', sourceText: text, producesHistory: true }
}

async function executeCP3(): Promise<CPResult> {
    const beforeTime = new Date()

    // Capture real taskbar clock screenshot
    const imageBase64 = await captureClockImage()
    expect(imageBase64.length).toBeGreaterThan(0)

    // Run real Tesseract OCR on the clock image
    const worker = await Tesseract.createWorker('eng', 1, { langPath: TESSERACT_LANG_PATH, cachePath: TESSERACT_LANG_PATH })
    const result = await worker.recognize(`data:image/png;base64,${imageBase64}`)
    await worker.terminate()
    const ocrText = result.data.text.trim()
    console.log(`[CP3] OCR text from taskbar clock: "${ocrText}"`)
    expect(ocrText.length).toBeGreaterThan(0)

    // Parse time from OCR and compare with current time
    const parsed = parseTimeFromOcr(ocrText)
    expect(parsed).not.toBeNull()
    console.log(`[CP3] Parsed time: ${parsed!.hours}:${String(parsed!.minutes).padStart(2, '0')}`)

    const nowHours = beforeTime.getHours()
    const nowMinutes = beforeTime.getMinutes()
    const timeClose = isTimeClose(parsed!.hours, parsed!.minutes, nowHours, nowMinutes, 2)
    expect(timeClose).toBe(true)

    // Also open recognize window to verify the full OCR pipeline
    const client = getTranslateClient()
    await client.evaluate(`
        window.electronAPI.ocr.openRecognize('${imageBase64}', ${JSON.stringify(ocrText)})
    `)

    // Wait for recognize window to appear
    await new Promise(r => setTimeout(r, 2000))
    const instance = globalThis.__e2e_instance as ElectronInstance
    const targets = await findAllTargets(instance.cdpPort)
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

async function executeCP4(): Promise<CPResult> {
    const text = `cp4 ocr translate ${Date.now()}`
    const client = getTranslateClient()
    await client.evaluate(`
        window.electronAPI.ocr.sendToTranslate(${JSON.stringify(text)})
    `)
    await waitForSourceText(text, 8000)

    const serviceList = await readConfig('translate_service_list') as string[]
    const results = await waitForAllServiceResults(serviceList)
    for (const r of Object.values(results)) {
        expect(r.length).toBeGreaterThan(0)
    }
    return { description: 'CP4 OCR Translate', sourceText: text, producesHistory: true }
}

async function executeCP5(): Promise<CPResult> {
    await triggerDictLookup('hello')

    // Wait for dict window to appear
    await new Promise(r => setTimeout(r, 2000))
    const instance = globalThis.__e2e_instance as ElectronInstance
    const targets = await findAllTargets(instance.cdpPort)
    const dictTarget = targets.find(t => t.url.includes('dict'))
    expect(dictTarget).toBeDefined()

    const dictClient = await CdpClient.connect(dictTarget!.webSocketDebuggerUrl)
    await dictClient.waitFor(async () => {
        const count = await dictClient.evaluate(
            `document.querySelectorAll('[data-result-key]').length`
        ) as number
        return count > 0
    }, 20000)

    // Verify at least one result card has content
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

async function executeCP6(): Promise<CPResult> {
    const text = `cp6 clipboard ${Date.now()}`
    // Write to system clipboard
    await triggerClipboardText(text)
    // Clipboard monitor only starts at app launch if config was true.
    // Since we can't start it at runtime, directly send the IPC that the monitor would send.
    await triggerClipboardTranslate(text)
    await waitForSourceText(text, 8000)

    const serviceList = await readConfig('translate_service_list') as string[]
    const results = await waitForAllServiceResults(serviceList)
    for (const r of Object.values(results)) {
        expect(r.length).toBeGreaterThan(0)
    }
    return { description: 'CP6 Clipboard Translate', sourceText: text, producesHistory: true }
}

// ── Main Test ──

describe('CP1-CP6 Combined Integration Test (Random Order)', () => {
    let instance: ElectronInstance
    let translateServiceList: string[] = []
    const cpResults: CPResult[] = []
    const executionOrder: string[] = []

    beforeAll(async () => {
        await ensureBuilt()
        instance = await startElectron()
        globalThis.__e2e_instance = instance
        init(instance.translateClient, instance.httpPort)
        await waitForSelector('textarea', 15000)

        // Enable clipboard monitor for CP6
        await writeConfig('clipboard_monitor', true)
        // Configure OCR service for CP3
        await writeConfig('recognize_service_list', ['tesseract@default'])
        // Ensure history is enabled
        await writeConfig('history_disable', false)

        // Clear history to get a clean baseline
        await clearHistory()
        await new Promise(r => setTimeout(r, 500))

        translateServiceList = await readConfig('translate_service_list') as string[]
        expect(translateServiceList.length).toBeGreaterThan(0)
    }, 120000)

    afterAll(async () => {
        cleanup()
        await stopElectron(instance)
    })

    it('executes all 6 critical paths in random order with correct intermediate state', async () => {
        const executors: Array<{ name: string; fn: () => Promise<CPResult> }> = [
            { name: 'CP1', fn: executeCP1 },
            { name: 'CP2', fn: executeCP2 },
            { name: 'CP3', fn: executeCP3 },
            { name: 'CP4', fn: executeCP4 },
            { name: 'CP5', fn: executeCP5 },
            { name: 'CP6', fn: executeCP6 }
        ]

        const order = shuffle(executors)
        console.log('[CP1-CP6] Execution order:', order.map(e => e.name).join(' → '))

        let prevHistoryCount = 0

        for (const { name, fn } of order) {
            console.log(`[CP1-CP6] Running ${name}...`)
            executionOrder.push(name)

            const result = await fn()
            cpResults.push(result)
            console.log(`[CP1-CP6] ${name} done. sourceText="${result.sourceText}" producesHistory=${result.producesHistory}`)

            // Verify translate window is still alive after each step
            const client = getTranslateClient()
            const alive = await client.evaluate('document.querySelector("textarea") !== null') as boolean
            expect(alive).toBe(true)

            // Brief pause for async history writes to settle
            await new Promise(r => setTimeout(r, 1000))
        }
    }, 600000) // 10 min timeout for the entire suite

    it('history contains entries from all translation CPs', async () => {
        const historyProducingCPs = cpResults.filter(r => r.producesHistory)
        if (historyProducingCPs.length === 0) return

        const expectedMin = historyProducingCPs.length * translateServiceList.length
        const actualCount = await waitForHistoryCount(expectedMin)
        expect(actualCount).toBeGreaterThanOrEqual(expectedMin)

        // Verify each translated sourceText appears in history
        const records = await getHistoryList(1, actualCount)
        for (const cp of historyProducingCPs) {
            const found = records.some(r => r.source_text === cp.sourceText)
            expect(found).toBe(true)
        }
    })

    it('translate window is still fully functional after all CPs', async () => {
        const client = getTranslateClient()
        await clearTextarea()
        await triggerTranslateViaApi('post-test verification')
        await waitForSourceText('post-test verification', 5000)

        const serviceList = await readConfig('translate_service_list') as string[]
        const results = await waitForAllServiceResults(serviceList)
        for (const r of Object.values(results)) {
            expect(r.length).toBeGreaterThan(0)
        }
    }, 60000)

    it('printed execution order for reproducibility', () => {
        console.log('[CP1-CP6] Final execution order:', executionOrder.join(' → '))
        console.log('[CP1-CP6] Results:', cpResults.map(r => `${r.description}: "${r.sourceText}"`))
        // This test always passes — just logs the order
        expect(executionOrder.length).toBe(6)
        expect(cpResults.length).toBe(6)
    })
})

// Extend globalThis for instance sharing
declare global {
    // eslint-disable-next-line no-var
    var __e2e_instance: ElectronInstance
}
