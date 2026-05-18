import { describe, expect, it } from 'vitest'
import { normalize_system_ocr_language } from '../../../electron/ipc/ocr_handlers'

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
