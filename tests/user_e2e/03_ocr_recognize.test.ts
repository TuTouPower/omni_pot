import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { CdpClient, CDP_PORT, findAllTargets } from './cdp_helper'
import { getTranslateClient, cleanupAllClients } from './test_utils'

// Prerequisite: electron-vite dev running with --remote-debugging-port=9225
// Note: OCR tests require the recognize window to be opened.
// We open it via electronAPI from the translate window.
//
// Run: npx electron-vite dev -- --remote-debugging-port=9225 &
// Then: npx vitest run tests/user_e2e/03_ocr_recognize.test.ts

describe('Critical Path 3: OCR 识别全流程', () => {
    let recognizeClient: CdpClient | null = null

    beforeAll(async () => {
        const client = await getTranslateClient()
        expect(client).toBeDefined()

        // Open recognize window with test data via electronAPI
        // Use a small 1x1 white PNG as test image
        const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        await client.evaluate(`
            window.electronAPI.ocr.openRecognize('${testImage}', 'test recognized text')
        `)

        // Wait for recognize window to appear
        await new Promise(r => setTimeout(r, 2000))

        // Find and connect to recognize window
        const targets = await findAllTargets(CDP_PORT)
        const recognizeTarget = targets.find(t => t.url.includes('recognize'))
        if (recognizeTarget) {
            recognizeClient = await CdpClient.connect(recognizeTarget.webSocketDebuggerUrl)
        }
    }, 20000)

    afterAll(() => {
        recognizeClient?.close()
        cleanupAllClients()
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
        const targets = await findAllTargets(CDP_PORT)
        const stillExists = targets.some(t => t.url.includes('recognize'))
        expect(stillExists).toBe(false)
    }, 10000)
})
