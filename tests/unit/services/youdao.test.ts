import { createHash } from 'crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { youdaoService } from '../../../src/services/youdao'

afterEach(() => {
    vi.restoreAllMocks()
})

describe('Youdao Translate Service', () => {
    it('uses v3 SHA-256 signing parameters', async () => {
        vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-3333-4444-555555555555')
        vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
        const fetch_spy = vi.spyOn(global, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ errorCode: '0', translation: ['你好'] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        )

        const text = 'abcdefghijklmnopqrstuvwxyz'
        const result = await youdaoService.translate(text, 'en', 'zh_cn', {
            appkey: 'app-id',
            key: 'app-secret',
        })

        expect(result).toBe('你好')
        const [url] = fetch_spy.mock.calls[0] as [string, RequestInit | undefined]
        const params = new URL(url).searchParams
        const salt = '11111111222233334444555555555555'
        const curtime = '1700000000'
        const input = 'abcdefghij26qrstuvwxyz'
        const expected_sign = createHash('sha256')
            .update(`app-id${input}${salt}${curtime}app-secret`)
            .digest('hex')

        expect(params.get('q')).toBe(text)
        expect(params.get('from')).toBe('en')
        expect(params.get('to')).toBe('zh-CHS')
        expect(params.get('appKey')).toBe('app-id')
        expect(params.get('salt')).toBe(salt)
        expect(params.get('curtime')).toBe(curtime)
        expect(params.get('signType')).toBe('v3')
        expect(params.get('sign')).toBe(expected_sign)
    })
})
