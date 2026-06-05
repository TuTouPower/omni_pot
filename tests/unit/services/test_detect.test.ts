import { afterEach, describe, it, expect, vi } from 'vitest'
import { detectLanguage } from '../../../src/services/detect'
import type { LanguageCode } from '../../../src/shared/types/language'

function mock_detect_local(lang: LanguageCode): ReturnType<typeof vi.fn> {
    const local = vi.fn(() => Promise.resolve({ lang, source: 'cld3' }))
    Object.defineProperty(window, 'electronAPI', {
        configurable: true,
        value: {
            detect: { local }
        }
    })
    return local
}

afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI')
})

describe('detectLanguage', () => {
    it('uses local cld3 detection through IPC', async () => {
        const local = mock_detect_local('fr')

        await expect(detectLanguage('Bonjour le monde')).resolves.toBe('fr')
        expect(local).toHaveBeenCalledWith('Bonjour le monde')
    })

    it('falls back to regex detection when IPC is unavailable', async () => {
        await expect(detectLanguage('你好世界')).resolves.toBe('zh_cn')
        await expect(detectLanguage('こんにちは')).resolves.toBe('ja')
        await expect(detectLanguage('안녕하세요')).resolves.toBe('ko')
        await expect(detectLanguage('Привіт світ')).resolves.toBe('uk')
        await expect(detectLanguage('สวัสดี')).resolves.toBe('th')
        await expect(detectLanguage('مرحبا')).resolves.toBe('ar')
        await expect(detectLanguage('سلام گچپژ')).resolves.toBe('fa')
        await expect(detectLanguage('שלום')).resolves.toBe('he')
        await expect(detectLanguage('नमस्ते')).resolves.toBe('hi')
        await expect(detectLanguage('Tôi là người')).resolves.toBe('vi')
        await expect(detectLanguage('Hello world')).resolves.toBe('en')
    })

    it('keeps repeated Chinese text Chinese in the regex fallback', async () => {
        await expect(detectLanguage('我爱你'.repeat(80))).resolves.toBe('zh_cn')
    })
})
