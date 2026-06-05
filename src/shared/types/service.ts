import type { LanguageCode } from './language'

export interface ServiceConfig {
  [key: string]: string | number | boolean | undefined
  instance_name?: string
  enable?: boolean
}

interface DictPronunciation {
  region: string
  phonetic: string
  audio_url?: string
}

interface DictDefinition {
  part_of_speech: string
  meanings: string[]
}

interface DictExample {
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

export function createServiceInstanceKey(service_key: string): string {
  const id = Math.random().toString(36).substring(2, 10)
  return `${service_key}@${id}`
}

export function getServiceKey(instance_key: string): string {
  return instance_key.split('@')[0] ?? instance_key
}
