import { describe, it, expect } from 'vitest'
import { googleService } from '../../../src/services/google'

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
})
