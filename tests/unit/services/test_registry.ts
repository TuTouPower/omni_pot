import { describe, it, expect } from 'vitest'
import type { TranslateService } from '@shared/types/service'
import { ServiceRegistry, dictionaryServiceRegistry, translateServiceRegistry } from '../../../src/services/registry'

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

describe('dictionaryServiceRegistry', () => {
  it('is a separate instance from translateServiceRegistry', () => {
    expect(dictionaryServiceRegistry).toBeDefined()
    expect(dictionaryServiceRegistry).not.toBe(translateServiceRegistry)
  })

  it('has dictionary services pre-registered after registerAllServices', async () => {
    const { registerAllServices } = await import('../../../src/services/index')
    registerAllServices()
    const keys = dictionaryServiceRegistry.getKeys()
    expect(keys).toContain('chinese_dictionary')
    expect(keys).toContain('ecdict')
    expect(keys).toContain('cambridge_dict')
    expect(keys).not.toContain('bing')
    expect(keys).not.toContain('google')
  })
})
