import { create } from 'zustand'
import type { LanguageCode } from '@shared/types/language'
import type { DictResult } from '@shared/types/service'

interface TranslateResults {
  [instanceKey: string]: string | DictResult | null
}

interface TranslateStore {
  sourceText: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  detectedLanguage: LanguageCode | null
  results: TranslateResults
  isTranslating: boolean
  requestId: number

  setSourceText: (text: string) => void
  setSourceLanguage: (lang: LanguageCode) => void
  setTargetLanguage: (lang: LanguageCode) => void
  setDetectedLanguage: (lang: LanguageCode | null) => void
  setResult: (instanceKey: string, result: string | DictResult | null) => void
  setIsTranslating: (flag: boolean) => void
  swapLanguages: (fallbackLanguage?: LanguageCode) => void
  clearResults: () => void
  nextRequestId: () => number
}

function guessDefaultTargetLang(): LanguageCode {
    const lang = (navigator.language ?? 'en').toLowerCase()
    if (lang.startsWith('zh')) return 'zh_cn'
    return 'en'
}

export const useTranslateStore = create<TranslateStore>()((set, get) => ({
  sourceText: '',
  sourceLanguage: 'auto',
  targetLanguage: guessDefaultTargetLang(),
  detectedLanguage: null,
  results: {},
  isTranslating: false,
  requestId: 0,

  setSourceText: (text) => set({ sourceText: text }),
  setSourceLanguage: (lang) => set({ sourceLanguage: lang }),
  setTargetLanguage: (lang) => set({ targetLanguage: lang }),
  setDetectedLanguage: (lang) => set({ detectedLanguage: lang }),
  setResult: (instanceKey, result) =>
    set((state) => ({ results: { ...state.results, [instanceKey]: result } })),
  setIsTranslating: (flag) => set({ isTranslating: flag }),
  swapLanguages: (fallbackLanguage) => {
    const { sourceLanguage, targetLanguage, detectedLanguage } = get()
    if (sourceLanguage === 'auto') {
      if (detectedLanguage) {
        const nextSourceLanguage = detectedLanguage === targetLanguage && fallbackLanguage && fallbackLanguage !== 'auto'
          ? fallbackLanguage
          : targetLanguage
        set({ sourceLanguage: nextSourceLanguage, targetLanguage: detectedLanguage, detectedLanguage: null })
      }
      return
    }
    set({ sourceLanguage: targetLanguage, targetLanguage: sourceLanguage, detectedLanguage: null })
  },
  clearResults: () => set({ results: {} }),
  nextRequestId: () => {
    const id = Date.now()
    set({ requestId: id })
    return id
  }
}))
