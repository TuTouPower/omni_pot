import { test, expect } from '@playwright/test'
import { ProxyAgent, setGlobalDispatcher } from 'undici'
import { bingService } from '../../../src/services/bing'
import { googleService } from '../../../src/services/google'
import { deeplService } from '../../../src/services/deepl'
import { mymemoryService } from '../../../src/services/mymemory'
import { cambridgeDictService } from '../../../src/services/cambridge_dict'

const deepl_long_multi_paragraph_text = 'Hello,\n\nI would like to request a manual review of this fictional service case.\n\nThis is not a standard cancellation request. The workspace in this synthetic example is unavailable, which means the customer cannot access or use the service described in this test text. The customer is requesting a refund or prorated refund for the period during which the fictional workspace is unavailable.\n\nPlease clarify the exact reason why the purchase is considered not eligible under the sample refund policy, and please escalate this synthetic case to the appropriate billing review team.\n\nReference number: 00000000\nPlan: Example Business\nIssue: Example workspace unavailable\nRequest: Refund or prorated refund for the unusable subscription period\n\nIf the suspension in this fictional scenario was applied in error, please also provide the steps to appeal or restore the workspace. If the workspace cannot be restored, please confirm that no further charges will occur and reconsider the refund request based on inability to access the paid example service.\n\nThank you.'
const deepl_long_single_paragraph_text = 'This synthetic customer support paragraph describes an unavailable example workspace, a manual review request, and a prorated refund request for a fictional subscription period. The customer cannot open the dashboard, export saved files, or invite team members while the workspace is suspended. Please explain the policy reason, escalate the case to billing review, and confirm whether future charges will stop if access cannot be restored.'
const deepl_portuguese_variant_text = 'The bus arrives at the station.'
const proxy_url = process.env['HTTPS_PROXY'] ?? process.env['https_proxy']
    ?? process.env['HTTP_PROXY'] ?? process.env['http_proxy']
    ?? process.env['ALL_PROXY'] ?? process.env['all_proxy']

if (proxy_url) {
    setGlobalDispatcher(new ProxyAgent(proxy_url))
}

const external_service_cases = [
    { catalog_section: '1.2', name: 'Bing Translate', run: () => bingService.translate('hello world', 'en', 'zh_cn', {}) },
    { catalog_section: '1.2', name: 'Google Translate', run: () => googleService.translate('hello world', 'en', 'zh_cn', {}) },
    { catalog_section: '1.2', name: 'DeepL free', run: () => throttled_deepl(() => deeplService.translate('hello world', 'en', 'zh_cn', { type: 'deeplx_free' })) },
    {
        catalog_section: '1.2',
        name: 'DeepL free long multi-paragraph text',
        source_text: deepl_long_multi_paragraph_text,
        target_contains_cjk: true,
        run: () => throttled_deepl(() => deeplService.translate(
            deepl_long_multi_paragraph_text,
            'en',
            'zh_cn',
            { type: 'deeplx_free' }
        ))
    },
    {
        catalog_section: '1.2',
        name: 'DeepL free long single paragraph text',
        source_text: deepl_long_single_paragraph_text,
        target_contains_cjk: true,
        run: () => throttled_deepl(() => deeplService.translate(
            deepl_long_single_paragraph_text,
            'en',
            'zh_cn',
            { type: 'deeplx_free' }
        ))
    },
    {
        catalog_section: '1.2',
        name: 'DeepL free Portuguese variant',
        source_text: deepl_portuguese_variant_text,
        run: () => throttled_deepl(() => deeplService.translate(
            deepl_portuguese_variant_text,
            'en',
            'pt_br',
            { type: 'deeplx_free' }
        ))
    },
    { catalog_section: '1.2', name: 'MyMemory', run: () => mymemoryService.translate('hello world', 'en', 'zh_cn', {}) },
    { catalog_section: '1.3', name: 'Cambridge Dictionary', run: () => cambridgeDictService.translate('hello', 'en', 'zh_cn', {}) },
] as const

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => { setTimeout(resolve, ms) })
}

let _deepl_sent = 0
async function throttled_deepl(fn: () => Promise<unknown>): Promise<unknown> {
    if (_deepl_sent > 0) await sleep(10_000)
    _deepl_sent++
    return fn()
}

function normalize_text(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function expect_result(value: unknown): void {
    if (typeof value === 'string') {
        expect(value.trim()).not.toBe('')
        return
    }

    expect(value).toEqual(expect.objectContaining({ type: 'dict' }))
}

function expect_translated_text(value: unknown, source_text: string): string {
    expect(typeof value).toBe('string')
    const translated_text = value as string

    expect(translated_text.trim()).not.toBe('')
    expect(normalize_text(translated_text)).not.toBe(normalize_text(source_text))

    return translated_text
}

function expect_zh_translation(value: unknown, source_text: string): void {
    expect(/[㐀-鿿]/u.test(expect_translated_text(value, source_text))).toBe(true)
}

test.describe('@external external service health', () => {
    test.describe.configure({ retries: 2 })
    test.skip(process.env.OMNI_POT_EXTERNAL_SERVICE_TESTS !== '1', 'Set OMNI_POT_EXTERNAL_SERVICE_TESTS=1 to run real public service checks')

    for (const { catalog_section, name, run, source_text, target_contains_cjk } of external_service_cases) {
        test(`${name} returns a real result (catalog §${catalog_section})`, async () => {
            test.setTimeout(120_000)
            const result = await run()

            const expected_source_text = typeof source_text === 'string' ? source_text : undefined
            if (expected_source_text) {
                if (target_contains_cjk) {
                    expect_zh_translation(result, expected_source_text)
                } else {
                    expect_translated_text(result, expected_source_text)
                }
            } else {
                expect_result(result)
            }
        })
    }

    test('Cambridge Dictionary returns pronunciations with audioUrl', async () => {
        test.setTimeout(120_000)
        const result = await cambridgeDictService.translate('hello', 'en', 'zh_cn', {})
        expect(result).toEqual(expect.objectContaining({ type: 'dict' }))
        const dict_result = result as { type: 'dict'; pronunciations: Array<{ audioUrl?: string }> }
        expect(dict_result.pronunciations.length).toBeGreaterThan(0)
        expect(dict_result.pronunciations[0].audioUrl).toBeTruthy()
    })

    test.skip('OCR, TTS, and detection external service placeholders stay here when public providers are added', () => {})

    // TTS is now provided by system_tts (Web Speech API → OS engine). It can
    // only be exercised inside a renderer, not from a Node test runner; the
    // translate_source_area and translate_result_cards specs cover it via
    // a stubbed window.speechSynthesis instead of round-tripping a network call.
})
