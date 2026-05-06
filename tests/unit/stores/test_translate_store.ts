import { describe, it, expect, beforeEach } from 'vitest'
import { useTranslateStore } from '../../../src/stores/translate_store'

describe('TranslateStore', () => {
  beforeEach(() => {
    useTranslateStore.setState({
      sourceText: '',
      targetLanguage: 'zh_cn',
      sourceLanguage: 'auto',
      detectedLanguage: null,
      results: {},
      isTranslating: false
    })
  })

  it('sets source text', () => {
    useTranslateStore.getState().setSourceText('hello')
    expect(useTranslateStore.getState().sourceText).toBe('hello')
  })

  it('sets target language', () => {
    useTranslateStore.getState().setTargetLanguage('ja')
    expect(useTranslateStore.getState().targetLanguage).toBe('ja')
  })

  it('swaps languages', () => {
    useTranslateStore.getState().setSourceLanguage('en')
    useTranslateStore.getState().setTargetLanguage('zh_cn')
    useTranslateStore.getState().swapLanguages()
    expect(useTranslateStore.getState().sourceLanguage).toBe('zh_cn')
    expect(useTranslateStore.getState().targetLanguage).toBe('en')
  })

  it('does not swap when source is auto', () => {
    useTranslateStore.getState().setSourceLanguage('auto')
    useTranslateStore.getState().setTargetLanguage('en')
    useTranslateStore.getState().swapLanguages()
    expect(useTranslateStore.getState().sourceLanguage).toBe('auto')
    expect(useTranslateStore.getState().targetLanguage).toBe('en')
  })

  it('sets translation result for a service instance', () => {
    useTranslateStore.getState().setResult('bing@abc', '你好')
    expect(useTranslateStore.getState().results['bing@abc']).toBe('你好')
  })

  it('clears results', () => {
    useTranslateStore.getState().setResult('bing@abc', '你好')
    useTranslateStore.getState().clearResults()
    expect(useTranslateStore.getState().results).toEqual({})
  })

  it('sets translating flag', () => {
    useTranslateStore.getState().setIsTranslating(true)
    expect(useTranslateStore.getState().isTranslating).toBe(true)
  })

  it('sets detected language', () => {
    useTranslateStore.getState().setDetectedLanguage('en')
    expect(useTranslateStore.getState().detectedLanguage).toBe('en')
  })

  it('clears detected language', () => {
    useTranslateStore.getState().setDetectedLanguage('en')
    useTranslateStore.getState().setDetectedLanguage(null)
    expect(useTranslateStore.getState().detectedLanguage).toBeNull()
  })
})
