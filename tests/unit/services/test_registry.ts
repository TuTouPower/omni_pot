import { describe, it, expect } from 'vitest'
import type { TranslateService } from '@shared/types/service'
import { ServiceRegistry } from '../../../src/services/registry'

const mockService: TranslateService = {
  key: 'mock',
  name: 'Mock Service',
  languages: ['auto', 'en', 'zh_cn'],
  translate: (text) => Promise.resolve(`translated: ${text}`),
  testConfig: () => Promise.resolve(true)
}

describe('ServiceRegistry', () => {
  it('registers and retrieves a service', () => {
    const registry = new ServiceRegistry<TranslateService>()
    registry.register(mockService)
    expect(registry.get('mock')).toBe(mockService)
  })

  it('returns undefined for unregistered service', () => {
    const registry = new ServiceRegistry<TranslateService>()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('lists all registered services', () => {
    const registry = new ServiceRegistry<TranslateService>()
    registry.register(mockService)
    expect(registry.getAll()).toHaveLength(1)
  })

  it('lists only keys', () => {
    const registry = new ServiceRegistry<TranslateService>()
    registry.register(mockService)
    expect(registry.getKeys()).toEqual(['mock'])
  })
})
