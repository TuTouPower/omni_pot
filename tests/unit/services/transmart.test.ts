import { afterEach, describe, expect, it, vi } from 'vitest'
import { transmartService } from '../../../src/services/transmart'

afterEach(() => {
    vi.restoreAllMocks()
})

describe('TranSmart Translate Service', () => {
    it('keeps the credential-based request contract', async () => {
        const fetch_spy = vi.spyOn(global, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ autoTranslation: '你好' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        )

        const result = await transmartService.translate('hello', 'en', 'zh_cn', {
            username: 'user',
            token: 'secret',
        })

        expect(result).toBe('你好')
        const [url, init] = fetch_spy.mock.calls[0] as [string, RequestInit]
        expect(url).toBe('https://transmart.qq.com/api/imt')
        expect(init.method).toBe('POST')
        expect(init.headers).toMatchObject({
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Bearer user:secret',
        })
        expect(init.body).toBe('source=en&target=zh&text=hello&revision=1')
    })
})
