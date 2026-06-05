import { describe, expect, test } from 'vitest'
import {
    baidu_ocr_token_payload,
    baidu_ocr_words_payload,
} from '../e2e/fixtures/stub_payloads'

describe('e2e stub payloads', () => {
    test('baidu ocr payload helpers match upstream response shapes', () => {
        expect(baidu_ocr_token_payload()).toEqual({ access_token: 'e2e-token', expires_in: 3600 })
        expect(baidu_ocr_words_payload('识别文本')).toEqual({ words_result: [{ words: '识别文本' }] })
    })
})
