import { describe, it, expect } from 'vitest'
import { googleService } from '../../../src/services/google'

const RUN_NET = process.env.RUN_NETWORK_TESTS === '1'

describe('Google Translate Service', () => {
  it('has correct key and name', () => {
    expect(googleService.key).toBe('google')
    expect(googleService.name).toBe('Google')
  })

  it('includes common languages', () => {
    expect(googleService.languages).toContain('auto')
    expect(googleService.languages).toContain('en')
    expect(googleService.languages).toContain('zh_cn')
  })

  it.skipIf(!RUN_NET)(
    'translates text via real Google API',
    async () => {
      const result = await googleService.translate('hello', 'en', 'zh_cn', {})
      expect(typeof result).toBe('string')
      expect((result as string).length).toBeGreaterThan(0)
    },
    15000
  )
})
