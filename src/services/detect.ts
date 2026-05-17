import type { LanguageCode } from '@shared/types/language'

async function detect_local(text: string): Promise<LanguageCode> {
    try {
        const result = await window.electronAPI.detect.local(text)
        return result.lang
    } catch {
        // IPC failure — full regex fallback (mirrors electron/detect/index.ts)
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
}

const BING_LANG_MAP: Record<string, LanguageCode> = {
    'zh-Hans': 'zh_cn', 'zh-Hant': 'zh_tw', 'yue': 'yue',
    'en': 'en', 'ja': 'ja', 'ko': 'ko', 'fr': 'fr', 'es': 'es',
    'ru': 'ru', 'de': 'de', 'it': 'it', 'tr': 'tr', 'pt': 'pt_pt',
    'vi': 'vi', 'id': 'id', 'th': 'th', 'ms': 'ms', 'ar': 'ar',
    'hi': 'hi', 'uk': 'uk', 'he': 'he', 'nl': 'nl', 'pl': 'pl',
    'sv': 'sv', 'fa': 'fa', 'nb': 'nb_no', 'nn': 'nn_no'
}

async function bing_detect(text: string): Promise<LanguageCode> {
    try {
        const auth_resp = await fetch('https://edge.microsoft.com/translate/auth')
        if (!auth_resp.ok) return await detect_local(text)
        const token = await auth_resp.text()

        const resp = await fetch('https://api-edge.cognitive.microsofttranslator.com/detect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify([{ text }])
        })
        if (!resp.ok) return await detect_local(text)
        const data = await resp.json() as Array<{ language: string }>
        if (data[0]?.language) {
            return BING_LANG_MAP[data[0].language] ?? await detect_local(text)
        }
    } catch { /* fallback */ }
    return await detect_local(text)
}

const GOOGLE_LANG_MAP: Record<string, LanguageCode> = {
    'zh-CN': 'zh_cn', 'zh-TW': 'zh_tw', 'zh': 'zh_cn',
    'en': 'en', 'ja': 'ja', 'ko': 'ko', 'fr': 'fr', 'es': 'es',
    'ru': 'ru', 'de': 'de', 'it': 'it', 'tr': 'tr', 'pt': 'pt_pt',
    'vi': 'vi', 'id': 'id', 'th': 'th', 'ms': 'ms', 'ar': 'ar',
    'hi': 'hi', 'uk': 'uk', 'he': 'he', 'nl': 'nl', 'pl': 'pl',
    'sv': 'sv', 'fa': 'fa', 'no': 'nb_no'
}

async function google_detect(text: string): Promise<LanguageCode> {
    try {
        const resp = await fetch(
            `https://translate.google.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`
        )
        if (!resp.ok) return await detect_local(text)
        const data = await resp.json() as [unknown, unknown, string]
        const detected = data[2]
        if (detected) {
            return GOOGLE_LANG_MAP[detected] ?? await detect_local(text)
        }
    } catch { /* fallback */ }
    return await detect_local(text)
}

const BAIDU_DETECT_LANG_MAP: Record<string, LanguageCode> = {
    'zh': 'zh_cn', 'cht': 'zh_tw', 'yue': 'yue',
    'en': 'en', 'jp': 'ja', 'kor': 'ko', 'fra': 'fr', 'spa': 'es',
    'ru': 'ru', 'de': 'de', 'it': 'it', 'tr': 'tr', 'pt': 'pt_pt',
    'vie': 'vi', 'id': 'id', 'th': 'th', 'may': 'ms', 'ara': 'ar',
    'hi': 'hi', 'nob': 'nb_no', 'nno': 'nn_no', 'per': 'fa', 'swe': 'sv',
    'pl': 'pl', 'nl': 'nl', 'ukr': 'uk', 'heb': 'he'
}

async function baidu_detect(text: string): Promise<LanguageCode> {
    try {
        const salt = Math.random().toString(36).substring(2)
        const resp = await fetch(
            `https://fanyi.baidu.com/transapi?from=auto&to=en&query=${encodeURIComponent(text)}&salt=${salt}`
        )
        if (!resp.ok) return await detect_local(text)
        const data = await resp.json() as { from?: string; error?: number }
        if (data.from && data.from !== 'auto' && data.from !== 'key') {
            return BAIDU_DETECT_LANG_MAP[data.from] ?? await detect_local(text)
        }
    } catch { /* fallback */ }
    return await detect_local(text)
}

const TENCENT_DETECT_LANG_MAP: Record<string, LanguageCode> = {
    'zh': 'zh_cn', 'zh-TW': 'zh_tw',
    'en': 'en', 'ja': 'ja', 'ko': 'ko', 'fr': 'fr', 'es': 'es',
    'ru': 'ru', 'de': 'de', 'it': 'it', 'tr': 'tr', 'pt': 'pt_pt',
    'vi': 'vi', 'id': 'id', 'th': 'th', 'ms': 'ms', 'ar': 'ar',
    'hi': 'hi', 'uk': 'uk', 'he': 'he', 'nl': 'nl', 'pl': 'pl',
    'sv': 'sv', 'fa': 'fa'
}

async function tencent_detect(text: string): Promise<LanguageCode> {
    try {
        const resp = await fetch('https://fanyi.qq.com/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'auto', target: 'en', sourceText: text, sessionUuid: Math.random().toString(36) })
        })
        if (!resp.ok) return await detect_local(text)
        const data = await resp.json() as { translate?: { records?: Array<{ sourceLang?: string }> } }
        const lang = data.translate?.records?.[0]?.sourceLang
        if (lang) {
            return TENCENT_DETECT_LANG_MAP[lang] ?? await detect_local(text)
        }
    } catch { /* fallback */ }
    return await detect_local(text)
}

const NIUTRANS_DETECT_LANG_MAP: Record<string, LanguageCode> = {
    'zh': 'zh_cn', 'cht': 'zh_tw', 'yue': 'yue',
    'en': 'en', 'ja': 'ja', 'ko': 'ko', 'fr': 'fr', 'es': 'es',
    'ru': 'ru', 'de': 'de', 'it': 'it', 'tr': 'tr', 'pt': 'pt_pt',
    'vi': 'vi', 'id': 'id', 'th': 'th', 'ms': 'ms', 'ar': 'ar',
    'hi': 'hi', 'mn': 'mn_mo', 'km': 'km', 'no': 'nb_no',
    'fa': 'fa', 'sv': 'sv', 'pl': 'pl', 'nl': 'nl', 'uk': 'uk', 'he': 'he'
}

async function niutrans_detect(text: string): Promise<LanguageCode> {
    try {
        const resp = await fetch('http://api.niutrans.com/NiuTransServer/translation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'auto', to: 'en', src_text: text })
        })
        if (!resp.ok) return await detect_local(text)
        const data = await resp.json() as { from?: string; error_code?: number }
        if (data.from && data.from !== 'auto') {
            return NIUTRANS_DETECT_LANG_MAP[data.from] ?? await detect_local(text)
        }
    } catch { /* fallback */ }
    return await detect_local(text)
}

export async function detectLanguage(text: string, engine?: string): Promise<LanguageCode> {
    const effective_engine = engine ?? 'local'
    switch (effective_engine) {
        case 'bing':
            return bing_detect(text)
        case 'google':
            return google_detect(text)
        case 'baidu':
            return baidu_detect(text)
        case 'tencent':
            return tencent_detect(text)
        case 'niutrans':
            return niutrans_detect(text)
        case 'local':
        default:
            return await detect_local(text)
    }
}
