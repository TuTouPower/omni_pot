import { describe, it, expect } from 'vitest'
import { detectLanguage } from '../../../src/services/detect'

describe('detectLanguage', () => {
    it('detects Chinese', () => {
        expect(detectLanguage('你好世界')).toBe('zh_cn')
        expect(detectLanguage('汉字')).toBe('zh_cn')
    })

    it('detects Japanese', () => {
        expect(detectLanguage('こんにちは')).toBe('ja')
        expect(detectLanguage('カタカナ')).toBe('ja')
    })

    it('detects Korean', () => {
        expect(detectLanguage('안녕하세요')).toBe('ko')
        expect(detectLanguage('한국어')).toBe('ko')
    })

    it('detects Russian', () => {
        expect(detectLanguage('Привет мир')).toBe('ru')
    })

    it('detects Ukrainian', () => {
        expect(detectLanguage('Привіт світ')).toBe('uk')
    })

    it('detects Thai', () => {
        expect(detectLanguage('สวัสดี')).toBe('th')
    })

    it('detects Arabic', () => {
        expect(detectLanguage('مرحبا')).toBe('ar')
    })

    it('detects Persian', () => {
        expect(detectLanguage('سلام گچپژ')).toBe('fa')
    })

    it('detects Hebrew', () => {
        expect(detectLanguage('שלום')).toBe('he')
    })

    it('detects Hindi', () => {
        expect(detectLanguage('नमस्ते')).toBe('hi')
    })

    it('detects Vietnamese', () => {
        expect(detectLanguage('Tôi là người')).toBe('vi')
    })

    it('defaults to English for Latin script', () => {
        expect(detectLanguage('Hello world')).toBe('en')
        expect(detectLanguage('Bonjour')).toBe('en')
    })
})
