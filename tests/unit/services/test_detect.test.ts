import http from 'node:http'
import { afterEach, describe, it, expect } from 'vitest'
import { detectLanguage, detect_engine_order, fetch_with_timeout } from '../../../src/services/detect'

function close_server(server: http.Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error)
            else resolve()
        })
    })
}

afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI')
})

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

    it('detects repeated Chinese text as Chinese instead of Japanese', async () => {
        expect(await detectLanguage('我爱你'.repeat(80), 'local')).toBe('zh_cn')
    })

    it('uses the configured remote engine first, then the documented fallback order', () => {
        expect(detect_engine_order('niutrans')).toEqual(['niutrans', 'bing', 'google', 'baidu', 'tencent', 'local'])
        expect(detect_engine_order('google')).toEqual(['google', 'bing', 'baidu', 'tencent', 'niutrans', 'local'])
    })

    it('times out stalled HTTP detection requests against a real local server', async () => {
        const server = http.createServer(() => {})
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

        try {
            const address = server.address()
            if (!address || typeof address === 'string') throw new Error('local test server did not expose a port')

            await expect(fetch_with_timeout(`http://127.0.0.1:${String(address.port)}`, {}, 50)).rejects.toThrow()
        } finally {
            await close_server(server)
        }
    })
})
