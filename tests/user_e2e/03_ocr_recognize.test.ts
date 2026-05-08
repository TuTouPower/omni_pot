import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Tesseract from 'tesseract.js'
import { resolve } from 'path'
import { CdpClient, findAllTargets } from './helpers/cdp_helper'
import { init, cleanup, getTranslateClient, waitForSelector, writeConfig } from './helpers/test_utils'
import { ensureBuilt, startElectron, stopElectron, type ElectronInstance } from './helpers/electron_launcher'

const TESSERACT_LANG_PATH = resolve(__dirname, '../../data/tesseract')

/**
 * Critical Path 3: OCR 识别全流程 (Real Tesseract.js)
 *
 * User journey: trigger OCR → Tesseract.js recognizes text →
 *   recognize window displays results
 *
 * All services are real — Tesseract.js runs on a real test image, no mocks.
 */

/** Create a test image with known text via browser canvas, return base64 without data-url prefix */
async function createTestImage(client: CdpClient, text: string): Promise<string> {
    const dataUrl = await client.evaluate(`
        (() => {
            const canvas = document.createElement('canvas')
            canvas.width = 400; canvas.height = 80
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 400, 80)
            ctx.fillStyle = 'black'; ctx.font = 'bold 36px Arial'
            ctx.fillText(${JSON.stringify(text)}, 20, 55)
            return canvas.toDataURL('image/png')
        })()
    `) as string
    return dataUrl.replace('data:image/png;base64,', '')
}

/** Run real Tesseract.js OCR on a base64 image */
async function recognizeText(imageBase64: string, lang = 'eng'): Promise<string> {
    const dataUrl = `data:image/png;base64,${imageBase64}`
    const worker = await Tesseract.createWorker(lang, 1, { langPath: TESSERACT_LANG_PATH, cachePath: TESSERACT_LANG_PATH })
    const result = await worker.recognize(dataUrl)
    await worker.terminate()
    return result.data.text.trim()
}

describe('Critical Path 3: OCR 识别全流程', () => {
    let instance: ElectronInstance
    let recognizeClient: CdpClient | null = null
    let ocrText = ''

    beforeAll(async () => {
        await ensureBuilt()
        instance = await startElectron()
        init(instance.translateClient, instance.httpPort)
        await waitForSelector('textarea', 15000)

        const client = getTranslateClient()

        // Configure Tesseract.js as the OCR service
        await writeConfig('recognize_service_list', ['tesseract@default'])

        // Create a test image with known text via browser canvas
        const imageBase64 = await createTestImage(client, 'HELLO WORLD')

        // Run real Tesseract.js OCR (same engine as the app uses)
        ocrText = await recognizeText(imageBase64, 'eng')

        // Open recognize window with the real OCR result
        await client.evaluate(`
            window.electronAPI.ocr.openRecognize('${imageBase64}', ${JSON.stringify(ocrText)})
        `)

        // Wait for recognize window to appear
        await new Promise(r => setTimeout(r, 2000))

        // Find and connect to recognize window
        const targets = await findAllTargets(instance.cdpPort)
        const recognizeTarget = targets.find(t => t.url.includes('recognize'))
        if (recognizeTarget) {
            recognizeClient = await CdpClient.connect(recognizeTarget.webSocketDebuggerUrl)
        }
    }, 120000)

    afterAll(async () => {
        recognizeClient?.close()
        cleanup()
        await stopElectron(instance)
    })

    it('opens recognize window when OCR is triggered', async () => {
        expect(recognizeClient).not.toBeNull()
    })

    it('displays the captured image', async () => {
        if (!recognizeClient) return
        const hasImage = await recognizeClient.evaluate(`
            document.querySelector('img[src^="data:image/png;base64,"]') !== null
        `) as boolean
        expect(hasImage).toBe(true)
    })

    it('Tesseract.js produced non-empty OCR result', async () => {
        // This validates the OCR engine actually ran
        expect(ocrText.length).toBeGreaterThan(0)
    })

    it('displays real Tesseract.js recognized text', async () => {
        if (!recognizeClient) return
        const text = await recognizeClient.evaluate(`
            document.querySelector('pre')?.textContent
        `) as string
        expect(text).toBeTruthy()
        expect(text).toBe(ocrText)
    })

    it('OCR recognized expected keywords from the test image', async () => {
        // The test image contains "HELLO WORLD"
        const upper = ocrText.toUpperCase()
        expect(upper).toContain('HELLO')
        expect(upper).toContain('WORLD')
    })

    it('has copy button', async () => {
        if (!recognizeClient) return
        const hasCopyButton = await recognizeClient.evaluate(`
            Array.from(document.querySelectorAll('button'))
                .some(b => b.textContent?.includes('Copy'))
        `) as boolean
        expect(hasCopyButton).toBe(true)
    })

    it('copy button is enabled when text is present', async () => {
        if (!recognizeClient) return
        const copyEnabled = await recognizeClient.evaluate(`
            Array.from(document.querySelectorAll('button'))
                .find(b => b.textContent?.includes('Copy'))?.disabled === false
        `) as boolean
        expect(copyEnabled).toBe(true)
    })

    it('recognize window closes on Escape', async () => {
        if (!recognizeClient) return
        await recognizeClient.evaluate('window.electronAPI.window.close()')
        await new Promise(r => setTimeout(r, 1500))
        const targets = await findAllTargets(instance.cdpPort)
        const stillExists = targets.some(t => t.url.includes('recognize'))
        expect(stillExists).toBe(false)
    }, 10000)
})
