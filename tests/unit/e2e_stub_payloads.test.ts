import { describe, expect, test, vi } from 'vitest'
import {
    baidu_ocr_token_payload,
    baidu_ocr_words_payload,
    build_free_dictionary_init_script,
    create_free_dictionary_fetch,
    free_dictionary_reconcile_payload,
    free_dictionary_run_payload,
    type FreeDictionaryEntryPayload,
} from '../user_e2e/fixtures/stub_payloads'

describe('e2e stub payloads', () => {
    test('free dictionary fetch fulfills configured words and delegates unknown URLs', async () => {
        const original_fetch = vi.fn(() => Promise.resolve(new Response('delegated', { status: 418 })))
        const fetch_stub = create_free_dictionary_fetch(original_fetch, { run: free_dictionary_run_payload })

        const stub_response = await fetch_stub('https://api.dictionaryapi.dev/api/v2/entries/en/run')
        const stub_json = await stub_response.json() as FreeDictionaryEntryPayload[]
        expect(stub_response.status).toBe(200)
        expect(stub_json[0].word).toBe('run')
        expect(stub_json[0].meanings).toHaveLength(3)

        const delegated_response = await fetch_stub('https://example.test/other')
        expect(delegated_response.status).toBe(418)
        expect(original_fetch).toHaveBeenCalledTimes(1)
    })

    test('free dictionary init script escapes embedded payload JSON', () => {
        const unsafe_text = `<tag>${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}`
        const script = build_free_dictionary_init_script({
            reconcile: free_dictionary_reconcile_payload,
            unsafe: [{
                word: 'unsafe',
                meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: unsafe_text }] }],
            }],
        })

        expect(script).toContain('\\u003ctag>')
        expect(script).toContain('\\u2028')
        expect(script).toContain('\\u2029')
        expect(script).toContain('reconcile')
    })

    test('baidu ocr payload helpers match upstream response shapes', () => {
        expect(baidu_ocr_token_payload()).toEqual({ access_token: 'e2e-token', expires_in: 3600 })
        expect(baidu_ocr_words_payload('识别文本')).toEqual({ words_result: [{ words: '识别文本' }] })
    })
})
