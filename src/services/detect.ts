import type { LanguageCode } from '@shared/types/language'

export function detectLanguage(text: string): LanguageCode | null {
    if (/[一-鿿]/.test(text)) return 'zh_cn'
    if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja'
    if (/[가-힯]/.test(text)) return 'ko'
    if (/[Ѐ-ӿ]/.test(text)) return 'ru'
    if (/[฀-๿]/.test(text)) return 'th'
    if (/[؀-ۿ]/.test(text)) return 'ar'
    return 'en'
}
