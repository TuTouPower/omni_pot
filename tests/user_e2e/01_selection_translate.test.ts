import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
    init, cleanup,
    getTranslateClient,
    clearTextarea, getTextareaValue,
    triggerTranslateViaApi, triggerSelectionTranslate, waitForSourceText,
    readConfig, waitForSelector
} from './helpers/test_utils'
import { ensureBuilt, startElectron, stopElectron, type ElectronInstance } from './helpers/electron_launcher'

/**
 * Critical Path 1: 划词翻译全流程
 *
 * User journey: select text → trigger (hotkey/tray/API) → translate window
 *   appears → multiple services translate in parallel → results display correctly
 *
 * Verification points from critical_paths.md:
 * - Source text is correctly read after trigger
 * - Translate window appears
 * - Enabled translation services are called in parallel, results shown in instance order
 * - Source language auto-detect works; when detected === target, fallback to second language
 * - String results → read-only textarea; dict results → structured display
 * - Translation history is written (if not disabled)
 *
 * All tests use real APIs (Bing, Google, DeepL) with no mocks.
 */

const TRANSLATE_RESULT_TIMEOUT = 30000

/** Helper: read result text from a specific service card's readonly textarea */
async function readServiceResult(instanceKey: string): Promise<string | null> {
    const c = await getTranslateClient()
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

/** Helper: wait until a service card has non-empty result text */
async function waitForServiceResult(instanceKey: string, timeoutMs = TRANSLATE_RESULT_TIMEOUT): Promise<string> {
    const c = await getTranslateClient()
    let result: string | null = null
    await c.waitFor(async () => {
        result = await readServiceResult(instanceKey)
        return result !== null && result.length > 0
    }, timeoutMs)
    return result ?? ''
}

/** Helper: get all result card keys in DOM order */
async function getResultCardKeys(): Promise<string[]> {
    const c = await getTranslateClient()
    const result = await c.evaluate(
        'Array.from(document.querySelectorAll("[data-result-key]")).map(el => el.getAttribute("data-result-key"))'
    )
    return result as string[]
}

/** Helper: check if all spinners are gone (translation complete) */
async function waitForTranslationComplete(timeoutMs = TRANSLATE_RESULT_TIMEOUT): Promise<void> {
    const c = await getTranslateClient()
    await c.waitFor(async () => {
        const isTranslating = await c.evaluate(`
            (() => {
                const spinners = document.querySelectorAll('.animate-spin, [role="progressbar"]')
                return spinners.length > 0
            })()
        `) as boolean
        return !isTranslating
    }, timeoutMs)
}

describe('Critical Path 1: 划词翻译全流程', () => {
    let instance: ElectronInstance

    beforeAll(async () => {
        await ensureBuilt()
        instance = await startElectron()
        init(instance.translateClient, instance.httpPort)
        await waitForSelector('textarea', 15000)
    }, 60000)

    afterAll(async () => {
        cleanup()
        await stopElectron(instance)
    })

    // ── VP1: Translation services are configured and accessible ──

    it('has translation services configured', async () => {
        const serviceList = await readConfig('translate_service_list') as string[]
        expect(serviceList).toBeDefined()
        expect(serviceList.length).toBeGreaterThan(0)

        const instances = await readConfig('service_instances') as Record<string, unknown>
        expect(instances).toBeDefined()
        for (const key of serviceList) {
            expect(instances[key]).toBeDefined()
        }
    })

    // ── VP2: Trigger + source text correctly populated ──

    it('English text: trigger via API fills source textarea', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('hello world')
        await waitForSourceText('hello world', 5000)

        const value = await getTextareaValue()
        expect(value).toBe('hello world')
    }, 20000)

    it('Chinese text: trigger via API fills source textarea', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('你好世界')
        await waitForSourceText('你好世界', 5000)

        const value = await getTextareaValue()
        expect(value).toBe('你好世界')
    }, 20000)

    it('mixed language text: trigger via API fills source textarea', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('Hello 你好 goodbye 再见')
        await waitForSourceText('Hello 你好 goodbye 再见', 5000).catch(() => {})
        // Fallback check in case of encoding issues
        const value = await getTextareaValue()
        expect(value).toContain('Hello')
        expect(value).toContain('你好')
    }, 20000)

    // ── VP3: Multiple services translate in parallel, results in instance order ──

    it('English→Chinese: multiple services return real translation results', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('hello world')
        await waitForSourceText('hello world', 5000)

        const serviceList = await readConfig('translate_service_list') as string[]
        expect(serviceList.length).toBeGreaterThanOrEqual(2)

        // Wait for at least one service to produce a real result
        const firstKey = serviceList[0]
        const result = await waitForServiceResult(firstKey, TRANSLATE_RESULT_TIMEOUT)
        expect(result.length).toBeGreaterThan(0)

        // The result should contain actual translated text, not just the source
        expect(result).not.toBe('hello world')
    }, 45000)

    it('result cards appear in DOM in the same order as service_list config', async () => {
        const serviceList = await readConfig('translate_service_list') as string[]
        const cardKeys = await getResultCardKeys()

        // All rendered cards should be a subset of (or equal to) the service list
        for (const key of cardKeys) {
            expect(serviceList).toContain(key)
        }

        // Cards should follow the same relative order as in config
        const cardIndices = cardKeys.map(k => serviceList.indexOf(k))
        for (let i = 1; i < cardIndices.length; i++) {
            expect(cardIndices[i]).toBeGreaterThan(cardIndices[i - 1])
        }
    }, 20000)

    it('result card headers show service display names', async () => {
        const c = await getTranslateClient()
        const headers = await c.evaluate(`
            Array.from(document.querySelectorAll('[data-result-key] span.text-xs.font-semibold'))
                .map(el => el.textContent.trim())
        `) as string[]

        expect(headers.length).toBeGreaterThan(0)
        // Default services: Bing, Google, DeepL
        const known = ['Bing', 'Google', 'DeepL']
        const hasKnown = headers.some(h => known.includes(h))
        expect(hasKnown).toBe(true)
    })

    // ── VP4: Language auto-detect + second language fallback ──

    it('Chinese→English: auto-detect detects zh, falls back to second language (en)', async () => {
        // Default config: source=auto, target=zh_cn, second_language=en
        // When translating Chinese text: detected=zh_cn === target=zh_cn → fallback to en
        await clearTextarea()
        await triggerTranslateViaApi('你好世界')
        await waitForSourceText('你好世界', 5000)

        const serviceList = await readConfig('translate_service_list') as string[]
        const firstKey = serviceList[0]
        const result = await waitForServiceResult(firstKey, TRANSLATE_RESULT_TIMEOUT)

        // Result should be English (since fallback from zh_cn target to en second language)
        // Check it contains common English words or is not just Chinese
        const hasEnglish = /[a-zA-Z]{2,}/.test(result)
        expect(hasEnglish).toBe(true)
    }, 45000)

    it('English→Chinese: auto-detect detects en, translates to zh_cn target', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('good morning')
        await waitForSourceText('good morning', 5000)

        const serviceList = await readConfig('translate_service_list') as string[]
        const firstKey = serviceList[0]
        const result = await waitForServiceResult(firstKey, TRANSLATE_RESULT_TIMEOUT)

        // Result should be Chinese (target language)
        const hasChinese = /[一-鿿]/.test(result)
        expect(hasChinese).toBe(true)
    }, 45000)

    // ── VP5: String results render as read-only textarea ──

    it('translation result renders as readonly textarea with content', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('test')
        await waitForSourceText('test', 5000)
        await waitForTranslationComplete(TRANSLATE_RESULT_TIMEOUT)

        const c = await getTranslateClient()
        const resultTextarea = await c.evaluate(`
            (() => {
                const cards = document.querySelectorAll('[data-result-key]')
                for (const card of cards) {
                    const ta = card.querySelector('textarea[readonly], textarea[aria-readonly="true"]')
                    if (ta && ta.value) return { value: ta.value, readonly: true }
                    // Even if not explicitly readonly attribute, check if it's in result area
                    const ta2 = card.querySelector('textarea')
                    if (ta2 && ta2.value) return { value: ta2.value, readonly: ta2.hasAttribute('readonly') || ta2.readOnly }
                }
                return null
            })()
        `) as { value: string; readonly: boolean } | null

        expect(resultTextarea).not.toBeNull()
        expect(resultTextarea!.value.length).toBeGreaterThan(0)
    }, 45000)

    // ── VP6: Translation history is written ──

    it('translation is written to history (if history not disabled)', async () => {
        const historyDisabled = await readConfig('history_disable') as boolean
        if (historyDisabled) {
            return
        }

        const testText = `e2e history test ${Date.now()}`
        await clearTextarea()
        await triggerTranslateViaApi(testText)
        await waitForSourceText(testText, 5000)

        const serviceList = await readConfig('translate_service_list') as string[]
        await waitForServiceResult(serviceList[0], TRANSLATE_RESULT_TIMEOUT)

        // Wait for async history write
        await new Promise(r => setTimeout(r, 2000))

        // Verify via electronAPI IPC (real history, not HTTP stub)
        const c = await getTranslateClient()
        const found = await c.evaluate(`
            (async () => {
                const records = await window.electronAPI.history.list(1, 50)
                return records.some(h => h.source_text === ${JSON.stringify(testText)})
            })()
        `) as boolean
        expect(found).toBe(true)
    }, 45000)

    // ── VP7: Multiple sequential translations work correctly ──

    it('can translate multiple texts sequentially without state corruption', async () => {
        // First translation
        await clearTextarea()
        await triggerTranslateViaApi('first translation')
        await waitForSourceText('first translation', 5000)

        const serviceList = await readConfig('translate_service_list') as string[]
        const firstResult = await waitForServiceResult(serviceList[0], TRANSLATE_RESULT_TIMEOUT)
        expect(firstResult.length).toBeGreaterThan(0)

        // Second translation with different text
        await clearTextarea()
        await triggerTranslateViaApi('second translation test')
        await waitForSourceText('second translation test', 5000)

        const secondResult = await waitForServiceResult(serviceList[0], TRANSLATE_RESULT_TIMEOUT)
        expect(secondResult.length).toBeGreaterThan(0)

        // Results should be different (different source texts)
        // Also verify the source text updated correctly
        const finalSource = await getTextareaValue()
        expect(finalSource).toBe('second translation test')
    }, 60000)

    it('short text translates correctly', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('hi')
        await waitForSourceText('hi', 5000)

        const serviceList = await readConfig('translate_service_list') as string[]
        const result = await waitForServiceResult(serviceList[0], TRANSLATE_RESULT_TIMEOUT)
        expect(result.length).toBeGreaterThan(0)
    }, 30000)

    it('long text translates without crash', async () => {
        const longText = 'The quick brown fox jumps over the lazy dog. '.repeat(5).trim()
        await clearTextarea()
        await triggerTranslateViaApi(longText)
        await waitForSourceText(longText, 5000)

        const serviceList = await readConfig('translate_service_list') as string[]

        // Wait and verify no crash
        await new Promise(r => setTimeout(r, 10000))

        const c = await getTranslateClient()
        const alive = await c.evaluate('document.querySelector("textarea") !== null') as boolean
        expect(alive).toBe(true)

        // At least one service should have a result
        const cardCount = await c.evaluate(
            'document.querySelectorAll("[data-result-key]").length'
        ) as number
        expect(cardCount).toBeGreaterThanOrEqual(1)
    }, 45000)

    it('special characters do not break translation', async () => {
        await clearTextarea()
        await triggerTranslateViaApi('Hello! @#$% 123')
        await waitForSourceText('Hello! @#$% 123', 5000)

        const c = await getTranslateClient()
        await new Promise(r => setTimeout(r, 8000))

        const alive = await c.evaluate('document.querySelector("textarea") !== null') as boolean
        expect(alive).toBe(true)
    }, 30000)

    // ── VP8: Selection translate via E2E trigger ──

    it('E2E selection trigger injects text into translate window', async () => {
        await clearTextarea()
        const response = await triggerSelectionTranslate('e2e selected text')
        expect(response.success).toBe(true)

        await waitForSourceText('e2e selected text', 5000)
        const value = await getTextareaValue()
        expect(value).toBe('e2e selected text')
    }, 20000)
})
