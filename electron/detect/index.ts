import type { LanguageCode } from '@shared/types/language'
import { log } from '../log'

const log_detect = log.scope('detect')

type WasmState = 'loading' | 'ready' | 'failed'

let wasm_state: WasmState = 'loading'
let cld3_factory: { create(minBytes?: number, maxBytes?: number): Cld3Instance } | undefined
let cld3_instance: Cld3Instance | undefined
let load_failed_logged = false
let runtime_failed_logged = false
let init_promise: Promise<void> | undefined

interface Cld3Instance {
    findLanguage(text: string): { language: string; is_reliable: boolean; probability: number; proportion: number }
}

// BCP-47 → LanguageCode mapping
export const CLD3_LANG_MAP: Record<string, LanguageCode> = {
    'zh': 'zh_cn',
    'zh-Hant': 'zh_tw',
    'ja': 'ja',
    'ko': 'ko',
    'en': 'en',
    'fr': 'fr',
    'de': 'de',
    'es': 'es',
    'it': 'it',
    'pt': 'pt_pt',
    'nl': 'nl',
    'tr': 'tr',
    'ru': 'ru',
    'ar': 'ar',
    'hi': 'hi',
    'th': 'th',
    'sv': 'sv',
    'pl': 'pl',
    'vi': 'vi',
}

// Regex-based fallback (current logic)
export function detect_regex(text: string): LanguageCode {
    if (/[一-鿿]/.test(text)) return 'zh_cn'
    if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja'
    if (/[가-힯]/.test(text)) return 'ko'
    if (/[Ѐ-ӿ]/.test(text)) {
        if (/[іїєґ]/.test(text)) return 'uk'
        return 'ru'
    }
    if ((/[฀-๿]/.test(text))) return 'th'
    if (/[؀-ۿ]/.test(text)) {
        if (/[گچپژ]/.test(text)) return 'fa'
        return 'ar'
    }
    if (/[֐-׿]/.test(text)) return 'he'
    if (/[ऀ-ॿ]/.test(text)) return 'hi'
    if (/[ăằẳẵặâầẩẫậđêềểễệôồổỗộơờởỡợùừửữựýỳỷỹỵ]/i.test(text)) return 'vi'
    return 'en'
}

export async function init_cld3(): Promise<void> {
    if (wasm_state === 'ready') return
    if (init_promise) return init_promise
    init_promise = do_init_cld3()
    return init_promise
}

async function do_init_cld3(): Promise<void> {
    const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => { reject(new Error('cld3-asm WASM load timeout')) }, 10000)
    })
    try {
        await Promise.race([load_cld3_internal(), timeout])
    } catch (e) {
        wasm_state = 'failed'
        init_promise = undefined
        if (!load_failed_logged) {
            log_detect.error('cld3-asm WASM load failed, falling back to regex: %s', e)
            load_failed_logged = true
        }
    }
}

async function load_cld3_internal(): Promise<void> {
    const { loadModule } = await import('cld3-asm')
    cld3_factory = await loadModule()
    // 0 = no minimum input length; we trust upstream length checks
    cld3_instance = cld3_factory.create(0)
    wasm_state = 'ready'
    init_promise = undefined
    log_detect.info('cld3-asm WASM loaded successfully')
}

export function detect_local_cld3(text: string): { lang: LanguageCode; source: 'cld3' | 'regex' } {
    if (wasm_state !== 'ready' || !cld3_instance) {
        return { lang: detect_regex(text), source: 'regex' }
    }

    try {
        const result = cld3_instance.findLanguage(text)

        if (!result.is_reliable) {
            return { lang: detect_regex(text), source: 'regex' }
        }

        const mapped = CLD3_LANG_MAP[result.language] as LanguageCode | undefined
        if (mapped) {
            return { lang: mapped, source: 'cld3' }
        }

        // Unmapped language: compare with regex
        const regex_result = detect_regex(text)
        if (regex_result !== 'en') {
            return { lang: regex_result, source: 'regex' }
        }
        return { lang: 'en', source: 'cld3' }
    } catch (e) {
        if (!runtime_failed_logged) {
            log_detect.warn('cld3 findLanguage threw, falling back: %s', e)
            runtime_failed_logged = true
        }
        return { lang: detect_regex(text), source: 'regex' }
    }
}

export function get_wasm_state(): WasmState {
    return wasm_state
}
