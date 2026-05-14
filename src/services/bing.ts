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

interface BingPageConfig {
  ig: string
  iid: string
  key: string
  token: string
}

let cachedConfig: BingPageConfig | null = null
let configExpiresAt = 0

async function getPageConfig(): Promise<BingPageConfig> {
  if (cachedConfig && Date.now() < configExpiresAt) return cachedConfig
  const resp = await fetch('https://www.bing.com/translator')
  const html = await resp.text()
  const ig_match = html.match(/IG:"([^"]+)"/)
  const iid_match = html.match(/data-iid="([^"]+)"/)
  const token_match = html.match(
    /params_AbusePreventionHelper\s*=\s*\[(\d+),\s*"([^"]+)"/
  )
  if (!ig_match || !iid_match || !token_match) {
    throw new Error('Failed to get Bing page config')
  }
  cachedConfig = { ig: ig_match[1], iid: iid_match[1], key: token_match[1], token: token_match[2] }
  configExpiresAt = Date.now() + 5 * 60 * 1000
  return cachedConfig
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
    const { ig, iid, key, token } = await getPageConfig()
    const fromLang = BING_LANG_MAP[from] ?? from
    const toLang = BING_LANG_MAP[to] ?? to

    const url = `https://www.bing.com/ttranslatev3?isVertical=1&IG=${ig}&IID=${iid}`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://www.bing.com/translator',
        'Origin': 'https://www.bing.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0'
      },
      body: new URLSearchParams({
        fromLang,
        to: toLang,
        text,
        token,
        key,
        tryFetchingGenderDebiasedTranslations: 'true'
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
      return typeof result === "string" ? result.length > 0 : !!result
    } catch {
      return false
    }
  }
}
