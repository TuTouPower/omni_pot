export const LANGUAGE_CODES = [
  'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
  'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
  'hi', 'mn_mo', 'mn_cy', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl',
  'nl', 'uk', 'he'
] as const

export type LanguageCode = typeof LANGUAGE_CODES[number]

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  auto: 'Auto Detect',
  zh_cn: '简体中文',
  zh_tw: '繁體中文',
  yue: '粤语',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  es: 'Español',
  ru: 'Русский',
  de: 'Deutsch',
  it: 'Italiano',
  tr: 'Türkçe',
  pt_pt: 'Português (Portugal)',
  pt_br: 'Português (Brasil)',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
  ms: 'Bahasa Melayu',
  ar: 'العربية',
  hi: 'हिन्दी',
  mn_mo: 'Монгол (Монгол)',
  mn_cy: 'Монгол (Кирил)',
  km: 'ភាសាខ្មែរ',
  nb_no: 'Norsk bokmål',
  nn_no: 'Norsk nynorsk',
  fa: 'فارسی',
  sv: 'Svenska',
  pl: 'Polski',
  nl: 'Nederlands',
  uk: 'Українська',
  he: 'עברית'
}
