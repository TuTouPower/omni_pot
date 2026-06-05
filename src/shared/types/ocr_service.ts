import type { LanguageCode } from './language'
import type { ServiceConfig } from './service'

export interface OcrService {
    readonly key: string
    readonly name: string
    readonly languages: LanguageCode[]
    recognize(base64Image: string, language: LanguageCode, config: ServiceConfig): Promise<string>
    testConfig(config: ServiceConfig): Promise<boolean>
}
