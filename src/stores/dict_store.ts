import { create } from 'zustand'
import type { DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

interface DictResults {
    [instanceKey: string]: DictResult | null
}

interface DictStore {
    word: string
    detectedLanguage: LanguageCode | null
    results: DictResults
    isLoading: boolean

    setWord: (text: string) => void
    setDetectedLanguage: (lang: LanguageCode | null) => void
    setResult: (instanceKey: string, result: DictResult | null) => void
    setIsLoading: (flag: boolean) => void
    clearResults: () => void
}

export const useDictStore = create<DictStore>()((set) => ({
    word: '',
    detectedLanguage: null,
    results: {},
    isLoading: false,

    setWord: (text) => { set({ word: text }); },
    setDetectedLanguage: (lang) => { set({ detectedLanguage: lang }); },
    setResult: (instanceKey, result) =>
        { set((state) => ({ results: { ...state.results, [instanceKey]: result } })); },
    setIsLoading: (flag) => { set({ isLoading: flag }); },
    clearResults: () => { set({ results: {} }); }
}))
