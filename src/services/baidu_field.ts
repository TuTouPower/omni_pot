import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { BAIDU_LANGUAGES, baidu_translate, baidu_test_config } from './baidu_common'

export const baiduFieldService: TranslateService = {
    key: 'baidu_field',
    name: 'Baidu Field',
    languages: BAIDU_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        const domain = (config.field as string) || 'it'
        return baidu_translate(text, from, to, config, {
            endpoint: 'fieldtranslate',
            domain,
            error_label: 'Baidu Field'
        })
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        return baidu_test_config(this, config)
    }
}
