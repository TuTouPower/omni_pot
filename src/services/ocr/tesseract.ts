import Tesseract from 'tesseract.js'
import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'

const TESSERACT_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'fa', 'pl', 'nl', 'uk'
]

const TESSERACT_LANG_MAP: Record<string, string> = {
    auto: 'eng+chi_sim',
    zh_cn: 'chi_sim',
    zh_tw: 'chi_tra',
    en: 'eng',
    ja: 'jpn',
    ko: 'kor',
    fr: 'fra',
    es: 'spa',
    ru: 'rus',
    de: 'deu',
    it: 'ita',
    tr: 'tur',
    pt_pt: 'por',
    pt_br: 'por',
    vi: 'vie',
    id: 'ind',
    th: 'tha',
    ms: 'msa',
    ar: 'ara',
    hi: 'hin',
    fa: 'fas',
    pl: 'pol',
    nl: 'nld',
    uk: 'ukr'
}

const TESSERACT_LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0'

function asset_url(path: string): string {
    return new URL(path, window.location.href).href
}

export const tesseractOcrService: OcrService = {
    key: 'tesseract',
    name: 'Tesseract',
    languages: TESSERACT_LANGUAGES,

    async recognize(
        base64Image: string,
        language: LanguageCode
    ): Promise<string> {
        const lang = TESSERACT_LANG_MAP[language] ?? 'eng'
        const data_url = `data:image/png;base64,${base64Image}`
        const result = await Tesseract.recognize(data_url, lang, {
            workerPath: asset_url('tesseract/worker.min.js'),
            corePath: asset_url('tesseract/core'),
            langPath: TESSERACT_LANG_PATH,
        })
        return result.data.text.trim()
    },

    testConfig(): Promise<boolean> {
        return Promise.resolve(true)
    }
}
