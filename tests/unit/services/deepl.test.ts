import { describe, it, expect, vi, afterEach } from 'vitest'
import { deeplService } from '../../../src/services/deepl'

afterEach(() => vi.restoreAllMocks())

describe('DeepL Translate Service', () => {
  it('has correct key and name', () => {
    expect(deeplService.key).toBe('deepl')
    expect(deeplService.name).toBe('DeepL')
  })

  it('supports Free, API, and DeepLX modes via config', () => {
    expect(deeplService.languages).toContain('auto')
    expect(deeplService.languages).toContain('en')
  })

  it('hits api-free.deepl.com for type=free with authKey', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ translations: [{ text: '你好' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const result = await deeplService.translate('hello', 'en', 'zh_cn', {
      type: 'free',
      authKey: 'fake-key'
    })
    expect(result).toBe('你好')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api-free.deepl.com/v2/translate')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'DeepL-Auth-Key fake-key'
    )
  })

  it('hits configured customUrl for type=deeplx without Authorization header', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ data: { translations: [{ text: 'hi' }] } }),
        { status: 200 }
      )
    )
    await deeplService.translate('hello', 'en', 'zh_cn', {
      type: 'deeplx',
      customUrl: 'http://localhost:1188/translate'
    })
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:1188/translate')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })
})
