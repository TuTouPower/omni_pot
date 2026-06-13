import { describe, expect, it } from 'vitest'
import { normalize_recognized_text } from '../../src/shared/text_normalize'

describe('normalize_recognized_text', () => {
    it('removes hyphenation at line breaks', () => {
        expect(normalize_recognized_text('inter-\n national')).toBe('international')
    })

    it('collapses multiple whitespace into single space', () => {
        expect(normalize_recognized_text('hello   world\t\nfoo')).toBe('hello world foo')
    })

    it('returns empty string unchanged', () => {
        expect(normalize_recognized_text('')).toBe('')
    })

    it('preserves text without hyphens or extra whitespace', () => {
        expect(normalize_recognized_text('hello world')).toBe('hello world')
    })

    it('removes trailing hyphen only when followed by whitespace', () => {
        expect(normalize_recognized_text('foo- bar')).toBe('foobar')
        expect(normalize_recognized_text('foo-bar')).toBe('foo-bar')
    })
})
