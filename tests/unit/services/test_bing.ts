import { describe, it, expect } from 'vitest'
import { bingService } from '../../../src/services/bing'

const RUN_NET = process.env.RUN_NETWORK_TESTS === '1'

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

  it.skipIf(!RUN_NET)(
    'translates text via real Bing API',
    async () => {
      const result = await bingService.translate('hello', 'en', 'zh_cn', {})
      expect(typeof result).toBe('string')
      expect((result as string).length).toBeGreaterThan(0)
    },
    15000
  )
})
