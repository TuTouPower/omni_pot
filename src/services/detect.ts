import type { LanguageCode } from '@shared/types/language'

function detect_regex(text: string): LanguageCode {
    if (/[一-鿿]/.test(text)) return 'zh_cn'
    if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja'
    if (/[가-힯]/.test(text)) return 'ko'
    if (/[Ѐ-ӿ]/.test(text)) {
        if (/[іїєґ]/.test(text)) return 'uk'
        return 'ru'
    }
    if (/[฀-๿]/.test(text)) return 'th'
    if (/[؀-ۿ]/.test(text)) {
        if (/[گچپژ]/.test(text)) return 'fa'
        return 'ar'
    }
    if (/[֐-׿]/.test(text)) return 'he'
    if (/[ऀ-ॿ]/.test(text)) return 'hi'
    if (/[ăằẳẵặâầẩẫậđêềểễệôồổỗộơờởỡợùừửữựýỳỷỹỵ]/i.test(text)) return 'vi'
    return 'en'
}

export async function detectLanguage(text: string): Promise<LanguageCode> {
    try {
        const result = await window.electronAPI.detect.local(text)
        return result.lang
    } catch {
        return detect_regex(text)
    }
}
