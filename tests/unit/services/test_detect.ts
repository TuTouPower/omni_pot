import { describe, it, expect } from 'vitest'
import { detectLanguage } from '../../../src/services/detect'

describe('detectLanguage', () => {
    it('detects Chinese', async () => {
        expect(await detectLanguage('你好世界', 'local')).toBe('zh_cn')
        expect(await detectLanguage('汉字', 'local')).toBe('zh_cn')
    })

    it('detects Japanese', async () => {
        expect(await detectLanguage('こんにちは', 'local')).toBe('ja')
        expect(await detectLanguage('カタカナ', 'local')).toBe('ja')
    })

    it('detects Korean', async () => {
        expect(await detectLanguage('안녕하세요', 'local')).toBe('ko')
        expect(await detectLanguage('한국어', 'local')).toBe('ko')
    })

    it('detects Russian', async () => {
        expect(await detectLanguage('Привет мир', 'local')).toBe('ru')
    })

    it('detects Ukrainian', async () => {
        expect(await detectLanguage('Привіт світ', 'local')).toBe('uk')
    })

    it('detects Thai', async () => {
        expect(await detectLanguage('สวัสดี', 'local')).toBe('th')
    })

    it('detects Arabic', async () => {
        expect(await detectLanguage('مرحبا', 'local')).toBe('ar')
    })

    it('detects Persian', async () => {
        expect(await detectLanguage('سلام گچپژ', 'local')).toBe('fa')
    })

    it('detects Hebrew', async () => {
        expect(await detectLanguage('שלום', 'local')).toBe('he')
    })

    it('detects Hindi', async () => {
        expect(await detectLanguage('नमस्ते', 'local')).toBe('hi')
    })

    it('detects Vietnamese', async () => {
        expect(await detectLanguage('Tôi là người', 'local')).toBe('vi')
    })

    it('defaults to English for Latin script', async () => {
        expect(await detectLanguage('Hello world', 'local')).toBe('en')
        expect(await detectLanguage('Bonjour', 'local')).toBe('en')
    })
})
