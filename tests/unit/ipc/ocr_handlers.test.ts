import { describe, expect, it } from 'vitest'
import { normalize_system_ocr_language } from '../../../electron/ipc/ocr_handlers'
import { normalize_recognized_text } from '@shared/text_normalize'

describe('normalize_system_ocr_language', () => {
    it('accepts known Windows OCR language tags', () => {
        expect(normalize_system_ocr_language('')).toBe('en-US')
        expect(normalize_system_ocr_language('en-US')).toBe('en-US')
        expect(normalize_system_ocr_language('zh-CN')).toBe('zh-CN')
    })

    it('rejects language tags that could escape the PowerShell string', () => {
        expect(() => normalize_system_ocr_language("en-US'); Write-Error 'owned")).toThrow('Unsupported OCR language')
    })
})

describe('normalize_recognized_text', () => {
    it('removes hyphenation followed by whitespace', () => {
        expect(normalize_recognized_text('recogni-\ntion')).toBe('recognition')
        expect(normalize_recognized_text('multi-  \n  ple')).toBe('multiple')
    })

    it('collapses multiple whitespace into single space', () => {
        expect(normalize_recognized_text('hello   world')).toBe('hello world')
        expect(normalize_recognized_text('a\n\n\nb')).toBe('a b')
        expect(normalize_recognized_text('a\t\tb')).toBe('a b')
    })

    it('combines hyphenation removal and whitespace collapse', () => {
        expect(normalize_recognized_text('Line one\nLine two with spaces')).toBe('Line one Line two with spaces')
    })

    it('does not trim leading/trailing whitespace', () => {
        expect(normalize_recognized_text('  hello  ')).toBe(' hello ')
        // The function only collapses internal whitespace; trimming is done by the caller.
    })

    it('returns empty string unchanged', () => {
        expect(normalize_recognized_text('')).toBe('')
    })
})
