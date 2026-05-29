import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PROVIDER_TIMEOUT_MS, fetch_with_timeout } from '../../../src/services/fetch_timeout'

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('fetch_with_timeout', () => {
    it('passes through init options', async () => {
        const response = new Response('ok')
        const fetch_spy = vi.spyOn(global, 'fetch').mockResolvedValue(response)
        const headers = { 'Content-Type': 'application/json' }
        const body = JSON.stringify({ text: 'hello' })

        const result = await fetch_with_timeout('https://example.com/api', {
            method: 'POST',
            headers,
            body,
        })

        expect(result).toBe(response)
        expect(fetch_spy).toHaveBeenCalledTimes(1)
        const [url, init] = fetch_spy.mock.calls[0] as [string, RequestInit]
        expect(url).toBe('https://example.com/api')
        expect(init.method).toBe('POST')
        expect(init.headers).toBe(headers)
        expect(init.body).toBe(body)
        expect(init.signal).toBeInstanceOf(AbortSignal)
    })

    it('returns response before timeout', async () => {
        vi.useFakeTimers()
        const response = new Response('ok')
        vi.spyOn(global, 'fetch').mockImplementation(() =>
            new Promise<Response>((resolve) => {
                setTimeout(() => { resolve(response) }, 10)
            })
        )

        const request = fetch_with_timeout('https://example.com/api', {}, 100)
        await vi.advanceTimersByTimeAsync(10)

        await expect(request).resolves.toBe(response)
    })

    it('rejects on timeout', async () => {
        vi.useFakeTimers()
        vi.spyOn(global, 'fetch').mockImplementation((_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new Error('aborted'))
                })
            })
        )

        const request = fetch_with_timeout('https://example.com/api', {}, 100)
        const expectation = expect(request).rejects.toThrow(/timeout/)
        await vi.advanceTimersByTimeAsync(100)

        await expectation
    })

    it('uses the default provider timeout', () => {
        expect(DEFAULT_PROVIDER_TIMEOUT_MS).toBe(15000)
    })
})
