import { describe, it, expect } from 'vitest'
import { detect_regex, detect_local_cld3, CLD3_LANG_MAP } from '../../src/main/detect'

describe('regex fallback detection', () => {
    it('detects Chinese', () => {
        expect(detect_regex('你好世界')).toBe('zh_cn')
    })

    it('detects Japanese', () => {
        expect(detect_regex('こんにちは')).toBe('ja')
    })

    it('detects Korean', () => {
        expect(detect_regex('안녕하세요')).toBe('ko')
    })

    it('detects Russian', () => {
        expect(detect_regex('Привет мир')).toBe('ru')
    })

    it('detects Ukrainian', () => {
        expect(detect_regex('Привіт світ')).toBe('uk')
    })

    it('detects Thai', () => {
        expect(detect_regex('สวัสดี')).toBe('th')
    })

    it('detects Arabic', () => {
        expect(detect_regex('مرحبا')).toBe('ar')
    })

    it('detects Persian', () => {
        expect(detect_regex('گفتگو')).toBe('fa')
    })

    it('detects Hebrew', () => {
        expect(detect_regex('שלום')).toBe('he')
    })

    it('detects Hindi', () => {
        expect(detect_regex('नमस्ते')).toBe('hi')
    })

    it('detects Vietnamese', () => {
        expect(detect_regex('xin chào mừng')).toBe('vi')
    })

    it('defaults to en for Latin text', () => {
        expect(detect_regex('Hello world')).toBe('en')
    })

    it('handles empty string', () => {
        expect(detect_regex('')).toBe('en')
    })
})

describe('BCP-47 mapping (spec compliance)', () => {
    const SPEC_MAPPINGS: Array<[string, string]> = [
        ['zh', 'zh_cn'],
        ['zh-Hant', 'zh_tw'],
        ['ja', 'ja'],
        ['ko', 'ko'],
        ['en', 'en'],
        ['fr', 'fr'],
        ['de', 'de'],
        ['es', 'es'],
        ['it', 'it'],
        ['pt', 'pt_pt'],
        ['nl', 'nl'],
        ['tr', 'tr'],
        ['ru', 'ru'],
        ['ar', 'ar'],
        ['hi', 'hi'],
        ['th', 'th'],
        ['sv', 'sv'],
        ['pl', 'pl'],
        ['vi', 'vi'],
    ]

    it.each(SPEC_MAPPINGS)('BCP-47 "%s" maps to LanguageCode "%s"', (bcp47, expected) => {
        expect(CLD3_LANG_MAP[bcp47]).toBe(expected)
    })
})

describe('detect_local_cld3 (pre-init fallback)', () => {
    it('falls back to regex before WASM init', () => {
        expect(detect_local_cld3('Hello').source).toBe('regex')
    })

    it('falls back to regex for Chinese before WASM init', () => {
        expect(detect_local_cld3('你好世界')).toEqual({ lang: 'zh_cn', source: 'regex' })
    })
})
