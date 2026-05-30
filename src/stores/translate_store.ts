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
  effectiveTargetLanguage: LanguageCode | null
  detectedLanguage: LanguageCode | null
  results: TranslateResults
  isTranslating: boolean
  requestId: number

  setSourceText: (text: string) => void
  setSourceLanguage: (lang: LanguageCode) => void
  setTargetLanguage: (lang: LanguageCode) => void
  setEffectiveTargetLanguage: (lang: LanguageCode | null) => void
  setDetectedLanguage: (lang: LanguageCode | null) => void
  setResult: (instanceKey: string, result: string | DictResult | null) => void
  setIsTranslating: (flag: boolean) => void
  swapLanguages: (fallbackLanguage?: LanguageCode) => void
  clearResults: () => void
  nextRequestId: () => number
}

function guessDefaultTargetLang(): LanguageCode {
    const lang = navigator.language.toLowerCase()
    if (lang.startsWith('zh')) return 'zh_cn'
    return 'en'
}

export const useTranslateStore = create<TranslateStore>()((set, get) => ({
  sourceText: '',
  sourceLanguage: 'auto',
  targetLanguage: guessDefaultTargetLang(),
  effectiveTargetLanguage: null,
  detectedLanguage: null,
  results: {},
  isTranslating: false,
  requestId: 0,

  setSourceText: (text) => { set((state) => ({ sourceText: text, effectiveTargetLanguage: null, isTranslating: false, requestId: state.requestId + 1 })); },
  setSourceLanguage: (lang) => { set((state) => state.sourceLanguage === lang
    ? { sourceLanguage: lang }
    : { sourceLanguage: lang, effectiveTargetLanguage: null, isTranslating: false, requestId: state.requestId + 1 }); },
  setTargetLanguage: (lang) => { set((state) => state.targetLanguage === lang
    ? { targetLanguage: lang, effectiveTargetLanguage: null }
    : { targetLanguage: lang, effectiveTargetLanguage: null, isTranslating: false, requestId: state.requestId + 1 }); },
  setEffectiveTargetLanguage: (lang) => { set({ effectiveTargetLanguage: lang }); },
  setDetectedLanguage: (lang) => { set({ detectedLanguage: lang }); },
  setResult: (instanceKey, result) =>
    { set((state) => ({ results: { ...state.results, [instanceKey]: result } })); },
  setIsTranslating: (flag) => { set({ isTranslating: flag }); },
  swapLanguages: (fallbackLanguage) => {
    const { sourceLanguage, targetLanguage, detectedLanguage } = get()
    if (sourceLanguage === 'auto') {
      if (detectedLanguage) {
        const nextSourceLanguage = detectedLanguage === targetLanguage && fallbackLanguage && fallbackLanguage !== 'auto'
          ? fallbackLanguage
          : targetLanguage
        set({
          sourceLanguage: nextSourceLanguage,
          targetLanguage: detectedLanguage,
          detectedLanguage: null,
          effectiveTargetLanguage: null,
          isTranslating: false,
          requestId: get().requestId + 1
        })
      }
      return
    }
    set({ sourceLanguage: targetLanguage, targetLanguage: sourceLanguage, detectedLanguage: null, effectiveTargetLanguage: null, isTranslating: false, requestId: get().requestId + 1 })
  },
  clearResults: () => { set({ results: {} }); },
  nextRequestId: () => {
    const id = get().requestId + 1
    set({ requestId: id })
    return id
  }
}))
