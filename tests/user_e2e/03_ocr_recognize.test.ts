import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { CdpClient, findAllTargets } from './helpers/cdp_helper'
import { init, cleanup, getTranslateClient } from './helpers/test_utils'
import { ensureBuilt, startElectron, stopElectron, type ElectronInstance } from './helpers/electron_launcher'

describe('Critical Path 3: OCR 识别全流程', () => {
    let instance: ElectronInstance
    let recognizeClient: CdpClient | null = null

    beforeAll(async () => {
        await ensureBuilt()
        instance = await startElectron()
        init(instance.translateClient, instance.httpPort)

        const client = getTranslateClient()

        // Open recognize window with test data via electronAPI
        const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        await client.evaluate(`
            window.electronAPI.ocr.openRecognize('${testImage}', 'test recognized text')
        `)

        // Wait for recognize window to appear
        await new Promise(r => setTimeout(r, 2000))

        // Find and connect to recognize window
        const targets = await findAllTargets(instance.cdpPort)
        const recognizeTarget = targets.find(t => t.url.includes('recognize'))
        if (recognizeTarget) {
            recognizeClient = await CdpClient.connect(recognizeTarget.webSocketDebuggerUrl)
        }
    }, 60000)

    afterAll(async () => {
        recognizeClient?.close()
        cleanup()
        await stopElectron(instance)
    })

    it('opens recognize window when OCR is triggered', async () => {
        // If recognize window was found, client is connected
        expect(recognizeClient).not.toBeNull()
    })

    it('displays the captured image', async () => {
        if (!recognizeClient) return
        const hasImage = await recognizeClient.evaluate(`
            document.querySelector('img[src^="data:image/png;base64,"]') !== null
        `) as boolean
        expect(hasImage).toBe(true)
    })

    it('displays recognized text', async () => {
        if (!recognizeClient) return
        const text = await recognizeClient.evaluate(`
            document.querySelector('pre')?.textContent
        `) as string
        expect(text).toBeTruthy()
        expect(text).toContain('test recognized text')
    })

    it('has copy button', async () => {
        if (!recognizeClient) return
        const hasCopyButton = await recognizeClient.evaluate(`
            Array.from(document.querySelectorAll('button'))
                .some(b => b.textContent?.includes('Copy'))
        `) as boolean
        expect(hasCopyButton).toBe(true)
    })

    it('has close button in header', async () => {
        if (!recognizeClient) return
        const hasCloseButton = await recognizeClient.evaluate(`
            document.querySelector('button svg') !== null
        `) as boolean
        expect(hasCloseButton).toBe(true)
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
        await recognizeClient.pressEscape()

        await new Promise(r => setTimeout(r, 1000))

        // Verify window is gone by checking targets
        const targets = await findAllTargets(instance.cdpPort)
        const stillExists = targets.some(t => t.url.includes('recognize'))
        expect(stillExists).toBe(false)
    }, 10000)
})
