import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const DEEPL_LANGUAGES: LanguageCode[] = [
  'auto', 'zh_cn', 'zh_tw', 'ja', 'en', 'ko', 'fr', 'es', 'ru', 'de',
  'it', 'tr', 'pt_pt', 'pt_br', 'id', 'sv', 'pl', 'nl', 'uk'
]

function getApiUrl(type: string, customUrl?: string): string {
  switch (type) {
    case 'free':
      return 'https://api-free.deepl.com/v2/translate'
    case 'api':
      return 'https://api.deepl.com/v2/translate'
    case 'deeplx':
      return customUrl || 'http://localhost:1188/translate'
    default:
      return 'https://api-free.deepl.com/v2/translate'
  }
}

export const deeplService: TranslateService = {
  key: 'deepl',
  name: 'DeepL',
  languages: DEEPL_LANGUAGES,

  async translate(
    text: string,
    from: LanguageCode,
    to: LanguageCode,
    config: ServiceConfig
  ): Promise<string> {
    const type = (config.type as string) || 'free'
    const authKey = (config.authKey as string) || ''
    const customUrl = config.customUrl as string | undefined
    const url = getApiUrl(type, customUrl)

    const body: Record<string, string> = {
      text,
      target_lang: to.toUpperCase().replace('_', '-')
    }
    if (from !== 'auto') {
      body.source_lang = from.toUpperCase().replace('_', '-')
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded'
    }

    if (type !== 'deeplx') {
      headers['Authorization'] = `DeepL-Auth-Key ${authKey}`
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: new URLSearchParams(body).toString()
    })

    if (!resp.ok) {
      throw new Error(`DeepL API error: ${resp.status}`)
    }

    const data = (await resp.json()) as {
      translations?: Array<{ text: string }>
      data?: { translations: Array<{ text: string }> }
    }

    if (type === 'deeplx') {
      return (
        data.data?.translations?.[0]?.text ??
        data.translations?.[0]?.text ??
        ''
      )
    }
    return data.translations?.[0]?.text ?? ''
  },

  async testConfig(config: ServiceConfig): Promise<boolean> {
    try {
      const result = await this.translate('hello', 'en', 'zh_cn', config)
      return result.length > 0
    } catch {
      return false
    }
  }
}
