import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { BAIDU_LANGUAGES, baidu_translate, baidu_test_config } from './baidu_common'

export const baiduService: TranslateService = {
    key: 'baidu',
    name: 'Baidu',
    languages: BAIDU_LANGUAGES,

    async translate(
        text: string,
        from: LanguageCode,
        to: LanguageCode,
        config: ServiceConfig
    ): Promise<string> {
        return baidu_translate(text, from, to, config, {
            endpoint: 'translate',
            error_label: 'Baidu'
        })
    },

    async testConfig(config: ServiceConfig): Promise<boolean> {
        return baidu_test_config(this, config)
    }
}
