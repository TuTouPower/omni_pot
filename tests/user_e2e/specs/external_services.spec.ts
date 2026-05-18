import { test, expect } from '@playwright/test'
import { bingService } from '../../../src/services/bing'
import { googleService } from '../../../src/services/google'
import { deeplService } from '../../../src/services/deepl'
import { lingvaService } from '../../../src/services/lingva'
import { mymemoryService } from '../../../src/services/mymemory'
import { cambridgeDictService } from '../../../src/services/cambridge_dict'
import { freeDictionaryService } from '../../../src/services/free_dictionary'

function expect_result(value: unknown): void {
    if (typeof value === 'string') {
        expect(value.trim()).not.toBe('')
        return
    }

    expect(value).toEqual(expect.objectContaining({ type: 'dict' }))
}

test.describe('@external external service health', () => {
    test.skip(process.env.OMNI_POT_EXTERNAL_SERVICE_TESTS !== '1', 'Set OMNI_POT_EXTERNAL_SERVICE_TESTS=1 to run real public-service checks')
    test.describe.configure({ retries: 2 })

    for (const { name, run } of [
        { name: 'Bing Translate', run: () => bingService.translate('hello world', 'en', 'zh_cn', {}) },
        { name: 'Google Translate', run: () => googleService.translate('hello world', 'en', 'zh_cn', {}) },
        { name: 'DeepL free', run: () => deeplService.translate('hello world', 'en', 'zh_cn', { type: 'deeplx_free' }) },
        { name: 'Lingva Translate', run: () => lingvaService.translate('hello world', 'en', 'zh_cn', {}) },
        { name: 'MyMemory', run: () => mymemoryService.translate('hello world', 'en', 'zh_cn', {}) },
        { name: 'Cambridge Dictionary', run: () => cambridgeDictService.translate('hello', 'en', 'zh_cn', {}) },
        { name: 'Free Dictionary', run: () => freeDictionaryService.translate('hello', 'en', 'zh_cn', {}) },
    ] as const) {
        test(`${name} returns a real result`, async () => {
            test.setTimeout(120_000)
            expect_result(await run())
        })
    }

    // TTS is now provided by system_tts (Web Speech API → OS engine). It can
    // only be exercised inside a renderer, not from a Node test runner; the
    // translate_source_area and translate_result_cards specs cover it via
    // a stubbed window.speechSynthesis instead of round-tripping a network call.
})
