import type { LanguageCode } from '@shared/types/language'

function detect_local(text: string): LanguageCode {
    // CJK
    if (/[一-鿿]/.test(text)) return 'zh_cn'
    if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja'
    if (/[가-힯]/.test(text)) return 'ko'
    // Cyrillic — Russian vs Ukrainian
    if (/[Ѐ-ӿ]/.test(text)) {
        // Ukrainian-specific: і, ї, є, ґ
        if (/[іїєґ]/.test(text)) return 'uk'
        return 'ru'
    }
    // Thai
    if (/[฀-๿]/.test(text)) return 'th'
    // Arabic + Persian (both use Arabic script)
    if (/[؀-ۿ]/.test(text)) {
        // Persian-specific: گ, چ, پ, ژ, ک, ی
        if (/[گچپژ]/.test(text)) return 'fa'
        return 'ar'
    }
    // Hebrew
    if (/[֐-׿]/.test(text)) return 'he'
    // Devanagari (Hindi)
    if (/[ऀ-ॿ]/.test(text)) return 'hi'
    // Vietnamese — Latin with combining marks or specific chars
    if (/[ăằẳẵặâầẩẫậđêềểễệôồổỗộơờởỡợùừửữựýỳỷỹỵ]/i.test(text)) return 'vi'
    // Default to English for Latin script
    return 'en'
}

export function detectLanguage(text: string): LanguageCode {
    return detect_local(text)
}
