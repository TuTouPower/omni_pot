import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { bingService } from '../../../src/services/bing'

describe('Bing Translate Service', () => {
  it('has correct key and name', () => {
    expect(bingService.key).toBe('bing')
    expect(bingService.name).toBe('Bing')
  })

  it('includes common languages', () => {
    expect(bingService.languages).toContain('auto')
    expect(bingService.languages).toContain('en')
    expect(bingService.languages).toContain('zh_cn')
  })

  describe('error handling', () => {
    beforeEach(() => {
      // Stub fetch: first call returns Bing page config HTML, second call returns an HTTP error
      let callCount = 0
      vi.spyOn(global, 'fetch').mockImplementation((input) => {
        callCount++
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        if (callCount === 1 || url.includes('bing.com/translator')) {
          // getPageConfig() response — set Response.url via defineProperty (jsdom doesn't support it in constructor)
          const resp = new Response(
            '<html>IG:"testIG" data-iid="testIID" params_AbusePreventionHelper = [1234, "testToken"]</html>',
            { status: 200 }
          )
          Object.defineProperty(resp, 'url', { value: 'https://www.bing.com/translator' })
          return Promise.resolve(resp)
        }
        // translate response — HTTP error
        return Promise.resolve(new Response('payload too large', { status: 413 }))
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('throws error with status code on HTTP failure', async () => {
      await expect(
        bingService.translate('hello', 'en', 'zh_cn', {})
      ).rejects.toThrow('Bing translate API 413')
    })
  })
})
