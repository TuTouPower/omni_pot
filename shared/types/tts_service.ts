import type { LanguageCode } from './language'

export interface TtsService {
    readonly key: string
    readonly name: string
    readonly languages: LanguageCode[]
    synthesize(text: string, language: LanguageCode, config: Record<string, unknown>): Promise<ArrayBuffer>
    testConfig(config: Record<string, unknown>): Promise<boolean>
}
