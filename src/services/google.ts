import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { fetch_with_timeout } from './fetch_timeout'

const GOOGLE_LANGUAGES: LanguageCode[] = [
  'auto', 'zh_cn', 'zh_tw', 'ja', 'en', 'ko', 'fr', 'es', 'ru', 'de',
  'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar', 'hi',
  'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he'
]

const GOOGLE_LANG_MAP: Record<string, string> = {
  auto: 'auto',
  zh_cn: 'zh-CN',
  zh_tw: 'zh-TW',
  pt_pt: 'pt',
  pt_br: 'pt',
  nb_no: 'no',
  nn_no: 'no'
}

function mapLang(code: LanguageCode): string {
  return GOOGLE_LANG_MAP[code] ?? code
}

export const googleService: TranslateService = {
  key: 'google',
  name: 'Google',
  languages: GOOGLE_LANGUAGES,

  async translate(
    text: string,
    from: LanguageCode,
    to: LanguageCode,
    config: ServiceConfig
  ): Promise<string> {
    const baseUrl = (config.custom_url as string) || 'https://translate.googleapis.com'

    const url = new URL(`${baseUrl}/translate_a/single`)
    url.searchParams.set('client', 'gtx')
    url.searchParams.set('sl', mapLang(from))
    url.searchParams.set('tl', mapLang(to))
    url.searchParams.set('dt', 't')
    url.searchParams.set('q', text)

    const resp = await fetch_with_timeout(url.toString())
    if (!resp.ok) {
      throw new Error(`Google translate API ${String(resp.status)}`)
    }
    const data = (await resp.json()) as Array<unknown>
    const segments = data[0] as Array<Array<unknown>> | undefined
    if (!segments || segments.length === 0) {
      throw new Error('Google translate returned empty response')
    }
    return segments.map((seg) => {
      const value = seg[0]
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : ''
    }).join('')
  },

  async testConfig(config: ServiceConfig): Promise<boolean> {
    try {
      const result = await this.translate('hello', 'en', 'zh_cn', config)
      return typeof result === 'string' && result.length > 0
    } catch {
      return false
    }
  }
}
