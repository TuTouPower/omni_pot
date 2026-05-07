import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const BING_LANGUAGES: LanguageCode[] = [
  'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
  'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
  'hi', 'nb_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he'
]

const BING_LANG_MAP: Record<string, string> = {
  auto: 'auto-detect',
  zh_cn: 'zh-Hans',
  zh_tw: 'zh-Hant',
  yue: 'yue',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  es: 'es',
  ru: 'ru',
  de: 'de',
  it: 'it',
  tr: 'tr',
  pt_pt: 'pt',
  pt_br: 'pt-br',
  vi: 'vi',
  id: 'id',
  th: 'th',
  ms: 'ms',
  ar: 'ar',
  hi: 'hi',
  nb_no: 'nb',
  nn_no: 'nb',
  fa: 'fa',
  sv: 'sv',
  pl: 'pl',
  nl: 'nl',
  uk: 'uk',
  he: 'he'
}

async function getToken(): Promise<{ key: string; token: string }> {
  const resp = await fetch('https://www.bing.com/translator')
  const html = await resp.text()
  const match = html.match(
    /params_AbusePreventionHelper\s*=\s*\[(\d+),\s*"([^"]+)"/
  )
  if (!match) throw new Error('Failed to get Bing token')
  return { key: match[1], token: match[2] }
}

export const bingService: TranslateService = {
  key: 'bing',
  name: 'Bing',
  languages: BING_LANGUAGES,

  async translate(
    text: string,
    from: LanguageCode,
    to: LanguageCode,
    _config: ServiceConfig
  ): Promise<string> {
    const { key, token } = await getToken()
    const fromLang = BING_LANG_MAP[from] ?? from
    const toLang = BING_LANG_MAP[to] ?? to

    const resp = await fetch('https://www.bing.com/ttranslatev3?isVertical=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://www.bing.com/translator',
        'Origin': 'https://www.bing.com'
      },
      body: new URLSearchParams({
        fromLang,
        to: toLang,
        text,
        token,
        key
      }).toString()
    })

    const data = (await resp.json()) as Array<{
      translations: Array<{ text: string }>
    }>
    return data[0]?.translations?.[0]?.text ?? ''
  },

  async testConfig(): Promise<boolean> {
    try {
      const result = await this.translate('hello', 'en', 'zh_cn', {})
      return result.length > 0
    } catch {
      return false
    }
  }
}
