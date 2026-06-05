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

    it('does not leave an active timeout after fetch resolves', async () => {
        vi.useFakeTimers()
        const response = new Response('ok')
        vi.spyOn(global, 'fetch').mockResolvedValue(response)
        const clear_timeout_spy = vi.spyOn(global, 'clearTimeout')

        await expect(fetch_with_timeout('https://example.com/api', {}, 100)).resolves.toBe(response)

        expect(clear_timeout_spy).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(100)
    })

    it('uses the default provider timeout', () => {
        expect(DEFAULT_PROVIDER_TIMEOUT_MS).toBe(15000)
    })

    it('blocks non-HTTP(S) protocols', async () => {
        await expect(fetch_with_timeout('file:///etc/passwd')).rejects.toThrow('non-HTTP(S)')
        await expect(fetch_with_timeout('ftp://example.com')).rejects.toThrow('non-HTTP(S)')
    })

    it('blocks HTTP to non-localhost hosts', async () => {
        await expect(fetch_with_timeout('http://example.com/api')).rejects.toThrow('insecure HTTP')
        await expect(fetch_with_timeout('http://10.0.0.1/api')).rejects.toThrow('insecure HTTP')
    })

    it('allows HTTP to localhost', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue(new Response('ok'))
        await expect(fetch_with_timeout('http://localhost:11434/api')).resolves.toBeInstanceOf(Response)
        await expect(fetch_with_timeout('http://127.0.0.1:11434/api')).resolves.toBeInstanceOf(Response)
    })

    it('blocks SSRF to cloud metadata endpoints', async () => {
        await expect(fetch_with_timeout('https://169.254.169.254/latest/meta-data/')).rejects.toThrow('reserved/metadata')
    })
})
