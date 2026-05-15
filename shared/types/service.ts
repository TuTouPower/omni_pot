import type { LanguageCode } from './language'

export interface ServiceConfig {
  [key: string]: string | number | boolean | undefined
  instanceName?: string
  enable?: boolean
}

export interface DictPronunciation {
  region: string
  phonetic: string
}

export interface DictDefinition {
  partOfSpeech: string
  meanings: string[]
}

export interface DictExample {
  source: string
  target: string
}

export interface DictResult {
  type: 'dict'
  pronunciations: DictPronunciation[]
  definitions: DictDefinition[]
  examples: DictExample[]
}

export interface TranslateService {
  readonly key: string
  readonly name: string
  readonly languages: LanguageCode[]
  translate(
    text: string,
    from: LanguageCode,
    to: LanguageCode,
    config: ServiceConfig
  ): Promise<string | DictResult>
  translateStream?(
    text: string,
    from: LanguageCode,
    to: LanguageCode,
    config: ServiceConfig
  ): AsyncGenerator<string, void, unknown>
  testConfig(config: ServiceConfig): Promise<boolean>
}

export interface ServiceInstance {
  key: string        // e.g. 'bing@abc123'
  serviceKey: string // e.g. 'bing'
  config: ServiceConfig
}

export function createServiceInstanceKey(serviceKey: string): string {
  const id = Math.random().toString(36).substring(2, 10)
  return `${serviceKey}@${id}`
}

export function getServiceKey(instanceKey: string): string {
  return instanceKey.split('@')[0] ?? instanceKey
}
