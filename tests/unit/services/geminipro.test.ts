import { describe, expect, it, vi } from 'vitest'
import { geminiproService } from '../../../src/services/geminipro'
import * as fetch_timeout from '../../../src/services/fetch_timeout'

describe('geminiproService', () => {
    it('sends api key in header instead of URL query', async () => {
        const fetch_spy = vi.spyOn(fetch_timeout, 'fetch_with_timeout').mockResolvedValue(new Response(JSON.stringify({
            candidates: [{ content: { parts: [{ text: '你好' }] } }],
        })))

        await geminiproService.translate('hello', 'en', 'zh_cn', {
            apiKey: 'secret-key',
            requestPath: 'https://generativelanguage.googleapis.com/v1beta',
            model: 'gemini-2.0-flash',
        })

        const [url, init] = fetch_spy.mock.calls[0] as [string, RequestInit]
        expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent')
        expect(url).not.toContain('secret-key')
        expect(init.headers).toMatchObject({
            'Content-Type': 'application/json',
            'x-goog-api-key': 'secret-key',
        })
    })
})
