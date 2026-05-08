import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Tesseract from 'tesseract.js'
import { resolve } from 'path'
import { init, cleanup, getTranslateClient, waitForSourceText, waitForSelector, writeConfig, readConfig } from './helpers/test_utils'
import { ensureBuilt, startElectron, stopElectron, type ElectronInstance } from './helpers/electron_launcher'

const TESSERACT_LANG_PATH = resolve(__dirname, '../../data/tesseract')

/**
 * Critical Path 4: OCR 翻译全流程 (Real Tesseract.js + Real Translation APIs)
 *
 * User journey: OCR recognizes text → sends to translate window →
 *   real services translate in parallel → results display correctly
 *
 * All services are real — no mocks.
 */

const TRANSLATE_RESULT_TIMEOUT = 30000

/** Run real Tesseract.js OCR on a base64 image */
async function recognizeText(imageBase64: string, lang = 'eng'): Promise<string> {
    const dataUrl = `data:image/png;base64,${imageBase64}`
    const worker = await Tesseract.createWorker(lang, 1, { langPath: TESSERACT_LANG_PATH, cachePath: TESSERACT_LANG_PATH })
    const result = await worker.recognize(dataUrl)
    await worker.terminate()
    return result.data.text.trim()
}

async function waitForAllServiceResults(
    serviceList: string[],
    timeoutMs = TRANSLATE_RESULT_TIMEOUT
): Promise<Record<string, string>> {
    const c = getTranslateClient()
    await new Promise(r => setTimeout(r, 300))

    const results: Record<string, string> = {}
    const deadline = Date.now() + timeoutMs
    for (const key of serviceList) {
        const remaining = deadline - Date.now()
        if (remaining <= 0) throw new Error(`Timed out waiting for results`)
        const client = getTranslateClient()
        let result: string | null = null
        await client.waitFor(async () => {
            result = await client.evaluate(`
                (() => {
                    const card = document.querySelector('[data-result-key="${key}"]')
                    if (!card) return null
                    const ta = card.querySelector('textarea')
                    if (ta && ta.value) return ta.value
                    const p = card.querySelector('p')
                    if (p && p.textContent && !p.textContent.includes('failed')) return p.textContent
                    return null
                })()
            `) as string | null
            return result !== null && result!.length > 0
        }, remaining)
        results[key] = result ?? ''
    }
    return results
}

describe('Critical Path 4: OCR 翻译全流程', () => {
    let instance: ElectronInstance
    let ocrText = ''

    beforeAll(async () => {
        await ensureBuilt()
        instance = await startElectron()
        init(instance.translateClient, instance.httpPort)
        await waitForSelector('textarea', 15000)

        const client = getTranslateClient()
        await writeConfig('recognize_service_list', ['tesseract@default'])

        // Create test image and run real OCR
        const imageBase64 = await client.evaluate(`
            (() => {
                const canvas = document.createElement('canvas')
                canvas.width = 400; canvas.height = 80
                const ctx = canvas.getContext('2d')
                ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 400, 80)
                ctx.fillStyle = 'black'; ctx.font = 'bold 36px Arial'
                ctx.fillText('GOOD MORNING', 20, 55)
                return canvas.toDataURL('image/png').split(',')[1]
            })()
        `) as string

        ocrText = await recognizeText(imageBase64, 'eng')

        // Send real OCR text to translate window via the OCR→translate pipeline
        await client.evaluate(`
            window.electronAPI.ocr.sendToTranslate(${JSON.stringify(ocrText)})
        `)

        // Wait for source text to populate
        await waitForSourceText(ocrText, 5000)
    }, 120000)

    afterAll(async () => {
        cleanup()
        await stopElectron(instance)
    })

    it('Tesseract.js produced non-empty OCR result', async () => {
        expect(ocrText.length).toBeGreaterThan(0)
    })

    it('OCR recognized expected English keywords', async () => {
        const upper = ocrText.toUpperCase()
        const hasGood = upper.includes('GOOD')
        const hasMorning = upper.includes('MORN')
        expect(hasGood || hasMorning).toBe(true)
    })

    it('translate window received OCR text', async () => {
        const client = getTranslateClient()
        const sourceValue = await client.evaluate(
            'document.querySelector("textarea")?.value ?? ""'
        ) as string
        expect(sourceValue).toBe(ocrText)
    })

    it('all translation services return real results from OCR text', async () => {
        const serviceList = await readConfig('translate_service_list') as string[]
        if (serviceList.length === 0) return

        const results = await waitForAllServiceResults(serviceList, TRANSLATE_RESULT_TIMEOUT)
        for (const result of Object.values(results)) {
            expect(result.length).toBeGreaterThan(0)
        }
    }, 45000)

    it('translate window stays alive after OCR translate pipeline', async () => {
        const client = getTranslateClient()
        const alive = await client.evaluate('document.querySelector("textarea") !== null') as boolean
        expect(alive).toBe(true)
    })

    it('can type and translate manually after OCR pipeline', async () => {
        const client = getTranslateClient()
        await client.evaluate('document.querySelector("textarea").value = ""')
        await client.evaluate('document.querySelector("textarea").focus()')
        await client.insertText('manual input after OCR')
        const value = await client.evaluate(
            'document.querySelector("textarea").value'
        ) as string
        expect(value).toBe('manual input after OCR')
    }, 15000)
})
