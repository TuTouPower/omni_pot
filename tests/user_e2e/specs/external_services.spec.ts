import { test, expect } from '@playwright/test'
import { bingService } from '../../../src/services/bing'
import { googleService } from '../../../src/services/google'
import { deeplService } from '../../../src/services/deepl'
import { mymemoryService } from '../../../src/services/mymemory'
import { cambridgeDictService } from '../../../src/services/cambridge_dict'
import { freeDictionaryService } from '../../../src/services/free_dictionary'

const deepl_long_multi_paragraph_text = 'Hello,\n\nI would like to request a manual review of this fictional service case.\n\nThis is not a standard cancellation request. The workspace in this synthetic example is unavailable, which means the customer cannot access or use the service described in this test text. The customer is requesting a refund or prorated refund for the period during which the fictional workspace is unavailable.\n\nPlease clarify the exact reason why the purchase is considered not eligible under the sample refund policy, and please escalate this synthetic case to the appropriate billing review team.\n\nReference number: 00000000\nPlan: Example Business\nIssue: Example workspace unavailable\nRequest: Refund or prorated refund for the unusable subscription period\n\nIf the suspension in this fictional scenario was applied in error, please also provide the steps to appeal or restore the workspace. If the workspace cannot be restored, please confirm that no further charges will occur and reconsider the refund request based on inability to access the paid example service.\n\nThank you.'
const deepl_long_single_paragraph_text = 'This synthetic customer support paragraph describes an unavailable example workspace, a manual review request, and a prorated refund request for a fictional subscription period. '.repeat(6)
const deepl_portuguese_variant_text = 'The bus arrives at the station.'

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

    for (const { name, run, source_text, target_contains_cjk } of [
        { name: 'Bing Translate', run: () => bingService.translate('hello world', 'en', 'zh_cn', {}) },
        { name: 'Google Translate', run: () => googleService.translate('hello world', 'en', 'zh_cn', {}) },
        { name: 'DeepL free', run: () => deeplService.translate('hello world', 'en', 'zh_cn', { type: 'deeplx_free' }) },
        {
            name: 'DeepL free long multi-paragraph text',
            source_text: deepl_long_multi_paragraph_text,
            target_contains_cjk: true,
            run: () => deeplService.translate(
                deepl_long_multi_paragraph_text,
                'en',
                'zh_cn',
                { type: 'deeplx_free' }
            )
        },
        {
            name: 'DeepL free long single paragraph text',
            source_text: deepl_long_single_paragraph_text,
            target_contains_cjk: true,
            run: () => deeplService.translate(
                deepl_long_single_paragraph_text,
                'en',
                'zh_cn',
                { type: 'deeplx_free' }
            )
        },
        {
            name: 'DeepL free Portuguese variant',
            source_text: deepl_portuguese_variant_text,
            run: () => deeplService.translate(
                deepl_portuguese_variant_text,
                'en',
                'pt_br',
                { type: 'deeplx_free' }
            )
        },
        { name: 'MyMemory', run: () => mymemoryService.translate('hello world', 'en', 'zh_cn', {}) },
        { name: 'Cambridge Dictionary', run: () => cambridgeDictService.translate('hello', 'en', 'zh_cn', {}) },
        { name: 'Free Dictionary', run: () => freeDictionaryService.translate('hello', 'en', 'zh_cn', {}) },
    ] as const) {
        test(`${name} returns a real result`, async () => {
            test.setTimeout(120_000)
            const result = await run()

            if (source_text) {
                if (target_contains_cjk) {
                    expect_zh_translation(result, source_text)
                } else {
                    expect_translated_text(result, source_text)
                }
            } else {
                expect_result(result)
            }
        })
    }

    // TTS is now provided by system_tts (Web Speech API → OS engine). It can
    // only be exercised inside a renderer, not from a Node test runner; the
    // translate_source_area and translate_result_cards specs cover it via
    // a stubbed window.speechSynthesis instead of round-tripping a network call.
})
