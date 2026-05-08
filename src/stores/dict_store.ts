import { create } from 'zustand'
import type { DictResult } from '@shared/types/service'

interface DictResults {
    [instanceKey: string]: DictResult | null
}

interface DictStore {
    word: string
    results: DictResults
    isLoading: boolean

    setWord: (text: string) => void
    setResult: (instanceKey: string, result: DictResult | null) => void
    setIsLoading: (flag: boolean) => void
    clearResults: () => void
}

export const useDictStore = create<DictStore>()((set) => ({
    word: '',
    results: {},
    isLoading: false,

    setWord: (text) => set({ word: text }),
    setResult: (instanceKey, result) =>
        set((state) => ({ results: { ...state.results, [instanceKey]: result } })),
    setIsLoading: (flag) => set({ isLoading: flag }),
    clearResults: () => set({ results: {} })
}))
