import { create } from 'zustand'
import type { LanguageCode } from '@shared/types/language'
import type { DictResult } from '@shared/types/service'
import { create_logger } from '../utils/logger'

const log = create_logger('translate-store')

interface TranslateResults {
  [instanceKey: string]: string | DictResult | null
}

interface TranslateStore {
  sourceText: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  effectiveTargetLanguage: LanguageCode | null
  lockedTargetLanguage: LanguageCode | null
  detectedLanguage: LanguageCode | null
  results: TranslateResults
  isTranslating: boolean
  requestId: number

  setSourceText: (text: string) => void
  setSourceLanguage: (lang: LanguageCode) => void
  setTargetLanguage: (lang: LanguageCode) => void
  setEffectiveTargetLanguage: (lang: LanguageCode | null) => void
  setLockedTargetLanguage: (lang: LanguageCode | null) => void
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
  lockedTargetLanguage: null,
  detectedLanguage: null,
  results: {},
  isTranslating: false,
  requestId: 0,

  setSourceText: (text) => {
    log.info('[store] setSourceText text=%j (prev locked=%s → null)', text.slice(0, 30), get().lockedTargetLanguage ?? '-')
    set((state) => ({ sourceText: text, effectiveTargetLanguage: null, lockedTargetLanguage: null, isTranslating: false, requestId: state.requestId + 1 }))
  },
  setSourceLanguage: (lang) => {
    log.info('[store] setSourceLanguage %s → %s', get().sourceLanguage, lang)
    set((state) => state.sourceLanguage === lang
      ? { sourceLanguage: lang }
      : { sourceLanguage: lang, effectiveTargetLanguage: null, isTranslating: false, requestId: state.requestId + 1 })
  },
  setTargetLanguage: (lang) => {
    log.info('[store] setTargetLanguage %s → %s (locked stays %s)', get().targetLanguage, lang, get().lockedTargetLanguage ?? '-')
    set((state) => state.targetLanguage === lang
      ? { targetLanguage: lang, effectiveTargetLanguage: null }
      : { targetLanguage: lang, effectiveTargetLanguage: null, isTranslating: false, requestId: state.requestId + 1 })
  },
  setEffectiveTargetLanguage: (lang) => { set({ effectiveTargetLanguage: lang }); },
  setLockedTargetLanguage: (lang) => {
    log.info('[store] setLockedTargetLanguage %s → %s', get().lockedTargetLanguage ?? '-', lang ?? '-')
    set({ lockedTargetLanguage: lang })
  },
  setDetectedLanguage: (lang) => { set({ detectedLanguage: lang }); },
  setResult: (instanceKey, result) =>
    { set((state) => ({ results: { ...state.results, [instanceKey]: result } })); },
  setIsTranslating: (flag) => { set({ isTranslating: flag }); },
  swapLanguages: (fallbackLanguage) => {
    const { sourceLanguage, targetLanguage, detectedLanguage } = get()
    log.info('[store] swapLanguages BEFORE src=%s target=%s detected=%s fallback=%s',
      sourceLanguage, targetLanguage, detectedLanguage ?? '-', fallbackLanguage ?? '-')
    if (sourceLanguage === 'auto') {
      if (detectedLanguage) {
        const nextSourceLanguage = detectedLanguage === targetLanguage && fallbackLanguage && fallbackLanguage !== 'auto'
          ? fallbackLanguage
          : targetLanguage
        log.info('[store] swapLanguages AFTER (auto branch) src=%s target=%s locked=%s',
          nextSourceLanguage, detectedLanguage, detectedLanguage)
        set({
          sourceLanguage: nextSourceLanguage,
          targetLanguage: detectedLanguage,
          detectedLanguage: null,
          effectiveTargetLanguage: null,
          lockedTargetLanguage: detectedLanguage,
          isTranslating: false,
          requestId: get().requestId + 1
        })
      } else {
        log.info('[store] swapLanguages SKIP: auto but no detected')
      }
      return
    }
    log.info('[store] swapLanguages AFTER (manual branch) src=%s target=%s locked=%s',
      targetLanguage, sourceLanguage, sourceLanguage)
    set({ sourceLanguage: targetLanguage, targetLanguage: sourceLanguage, detectedLanguage: null, effectiveTargetLanguage: null, lockedTargetLanguage: sourceLanguage, isTranslating: false, requestId: get().requestId + 1 })
  },
  clearResults: () => { set({ results: {} }); },
  nextRequestId: () => {
    const id = get().requestId + 1
    set({ requestId: id })
    return id
  }
}))
