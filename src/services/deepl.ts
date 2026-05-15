import type { TranslateService, ServiceConfig } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

const DEEPL_LANGUAGES: LanguageCode[] = [
  'auto', 'zh_cn', 'zh_tw', 'ja', 'en', 'ko', 'fr', 'es', 'ru', 'de',
  'it', 'tr', 'pt_pt', 'pt_br', 'id', 'sv', 'pl', 'nl', 'uk'
]

const DEEPL_LANG_MAP: Record<string, string> = {
  auto: 'auto',
  zh_cn: 'ZH',
  zh_tw: 'ZH',
  zh_tw_hant: 'ZH-Hant',
  ja: 'JA',
  en: 'EN',
  ko: 'KO',
  fr: 'FR',
  es: 'ES',
  ru: 'RU',
  de: 'DE',
  it: 'IT',
  tr: 'TR',
  pt_pt: 'PT-PT',
  pt_br: 'PT-BR',
  id: 'ID',
  sv: 'SV',
  pl: 'PL',
  nl: 'NL',
  uk: 'UK'
}

const DEEPL_FREE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'User-Agent': 'DeepL/1627620 CFNetwork/3826.500.62.2.1 Darwin/24.4.0',
  Accept: '*/*',
  'X-App-Os-Name': 'iOS',
  'X-App-Os-Version': '18.4.0',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'X-App-Device': 'iPhone16,2',
  Referer: 'https://www.deepl.com/',
  'X-Product': 'translator',
  'X-App-Build': '1627620',
  'X-App-Version': '25.1'
}

function get_i_count(text: string): number {
  return (text.match(/i/g) || []).length
}

function get_random_id(): number {
  return (Math.floor(Math.random() * 99_999) + 8_300_000) * 1000
}

function get_timestamp(i_count: number): number {
  const ts = Date.now()
  if (i_count === 0) return ts
  const adjusted = i_count + 1
  return ts - (ts % adjusted) + adjusted
}

function format_post_json(post_data: object): string {
  const str = JSON.stringify(post_data)
  const id = (post_data as { id: number }).id
  const add_space = (id + 5) % 29 === 0 || (id + 3) % 13 === 0
  return str.replace(
    '"method":"',
    add_space ? '"method" : "' : '"method": "'
  )
}

function get_lang_code(lang: LanguageCode): string {
  const mapped = DEEPL_LANG_MAP[lang]
  if (mapped && mapped !== 'auto') return mapped
  const upper = lang.toUpperCase().replace('_', '-')
  if (upper.includes('-')) return upper.split('-')[0] ?? upper
  return upper
}

async function translate_free(
  text: string,
  from: LanguageCode,
  to: LanguageCode
): Promise<string> {
  const source_lang = from === 'auto' ? 'auto' : get_lang_code(from)
  const target_lang = get_lang_code(to)

  const i_count = get_i_count(text)
  const id = get_random_id()

  const post_data = {
    jsonrpc: '2.0',
    method: 'LMT_handle_jobs',
    id,
    params: {
      commonJobParams: {
        mode: 'translate',
        formality: 'undefined',
        transcribe_as: 'romanize',
        advancedMode: false,
        textType: 'plaintext',
        wasSpoken: false
      },
      lang: {
        source_lang_user_selected: 'auto',
        target_lang: target_lang,
        ...(source_lang !== 'auto' && { source_lang_computed: source_lang })
      },
      jobs: [
        {
          kind: 'default',
          preferred_num_beams: 4,
          raw_en_context_before: [],
          raw_en_context_after: [],
          sentences: [{ prefix: '', text, id: 0 }]
        }
      ],
      timestamp: get_timestamp(i_count)
    }
  }

  const resp = await fetch('https://www2.deepl.com/jsonrpc', {
    method: 'POST',
    headers: DEEPL_FREE_HEADERS,
    body: format_post_json(post_data)
  })

  if (!resp.ok) {
    throw new Error(`DeepL free API error: ${String(resp.status)}`)
  }

  const data = (await resp.json()) as {
    result?: {
      translations?: Array<{
        beams?: Array<{
          sentences?: Array<{ text: string }>
        }>
      }>
    }
    error?: { message: string }
  }

  if (data.error) {
    throw new Error(`DeepL free API error: ${data.error.message}`)
  }

  const translation = data.result?.translations?.[0]?.beams?.[0]?.sentences?.[0]?.text
  if (!translation) {
    throw new Error('DeepL free API: no translation returned')
  }
  return translation
}

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
    const type = (config.type as string) || 'deeplx_free'

    if (type === 'deeplx_free') {
      return translate_free(text, from, to)
    }

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
      throw new Error(`DeepL API error: ${String(resp.status)}`)
    }

    const data = (await resp.json()) as {
      translations?: Array<{ text: string }>
      data?: { translations: Array<{ text: string }> }
    }

    if (type === 'deeplx') {
      return (
        data.data?.translations[0]?.text ??
        data.translations?.[0]?.text ??
        ''
      )
    }
    return data.translations?.[0]?.text ?? ''
  },

  async testConfig(config: ServiceConfig): Promise<boolean> {
    try {
      const result = await this.translate('hello', 'en', 'zh_cn', config)
      return typeof result === "string" ? result.length > 0 : !!result
    } catch {
      return false
    }
  }
}
