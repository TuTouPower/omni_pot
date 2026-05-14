import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Icons } from '../../components/icons'
import { SourceArea } from './source_area'
import { LanguageArea } from './language_area'
import { TargetArea } from './target_area'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { detectLanguage } from '../../services/detect'
import { getServiceKey } from '@shared/types/service'
import type { DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'

export default function TranslateWindow(): React.ReactElement {
    const sourceText = useTranslateStore((s) => s.sourceText)
    const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
    const targetLanguage = useTranslateStore((s) => s.targetLanguage)
    const detectedLanguage = useTranslateStore((s) => s.detectedLanguage)
    const setIsTranslating = useTranslateStore((s) => s.setIsTranslating)
    const setResult = useTranslateStore((s) => s.setResult)
    const clearResults = useTranslateStore((s) => s.clearResults)
    const setSourceText = useTranslateStore((s) => s.setSourceText)
    const setDetectedLanguage = useTranslateStore((s) => s.setDetectedLanguage)
    const requestId = useTranslateStore((s) => s.requestId)
    const nextRequestId = useTranslateStore((s) => s.nextRequestId)

    const serviceList = useConfigStore((s) => s.config.translate_service_list)
    const serviceInstances = useConfigStore((s) => s.config.service_instances)
    const alwaysOnTop = useConfigStore((s) => s.config.translate_always_on_top)
    const closeOnBlur = useConfigStore((s) => s.config.translate_close_on_blur)
    const secondLanguage = useConfigStore((s) => s.config.translate_second_language)
    const incrementalTranslate = useConfigStore((s) => s.config.incremental_translate)
    const deleteNewline = useConfigStore((s) => s.config.translate_delete_newline)
    const autoCopy = useConfigStore((s) => s.config.translate_auto_copy)
    const hideSource = useConfigStore((s) => s.config.hide_source)
    const historyDisable = useConfigStore((s) => s.config.history_disable)
    const ttsServiceList = useConfigStore((s) => s.config.tts_service_list)
    const configTargetLang = useConfigStore((s) => s.config.translate_target_language)
    const configSourceLang = useConfigStore((s) => s.config.translate_source_language)
    const appFont = useConfigStore((s) => s.config.app_font)
    const appFontSize = useConfigStore((s) => s.config.app_font_size)
    const setStoreTargetLang = useTranslateStore((s) => s.setTargetLanguage)
    const setStoreSourceLang = useTranslateStore((s) => s.setSourceLanguage)

    useEffect(() => {
        setStoreTargetLang(configTargetLang as LanguageCode)
        setStoreSourceLang(configSourceLang as LanguageCode)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const [forceShowSource, setForceShowSource] = useState(false)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        window.electronAPI.ready('translate')
    }, [])

    const handleTranslate = useCallback(async (textOverride?: string) => {
        const textToTranslate = textOverride ?? useTranslateStore.getState().sourceText
        if (!textToTranslate.trim()) return

        const id = nextRequestId()
        setIsTranslating(true)
        clearResults()

        const detected = sourceLanguage === 'auto' ? await detectLanguage(textToTranslate, useConfigStore.getState().config.translate_detect_engine) : null
        if (detected) setDetectedLanguage(detected)

        let effectiveTarget = targetLanguage
        if (sourceLanguage === 'auto' && detected && detected === targetLanguage) {
            effectiveTarget = secondLanguage as LanguageCode
        }

        const resultsMap: Record<string, string | DictResult | null> = {}

        const promises = serviceList.map(async (instanceKey) => {
            const serviceKey = getServiceKey(instanceKey)
            const service = translateServiceRegistry.get(serviceKey)
            if (!service) {
                resultsMap[instanceKey] = null
                if (useTranslateStore.getState().requestId === id) {
                    setResult(instanceKey, null)
                }
                return
            }
            const instanceConfig = serviceInstances[instanceKey]?.config ?? {}

            try {
                if (service.translateStream) {
                    let accumulated = ''
                    let lastUpdateTime = 0
                    setResult(instanceKey, '')
                    for await (const chunk of service.translateStream(textToTranslate, sourceLanguage, effectiveTarget, instanceConfig)) {
                        accumulated += chunk
                        const now = Date.now()
                        if (now - lastUpdateTime > 50 && useTranslateStore.getState().requestId === id) {
                            setResult(instanceKey, accumulated)
                            lastUpdateTime = now
                        }
                    }
                    if (useTranslateStore.getState().requestId === id) {
                        setResult(instanceKey, accumulated)
                    }
                    resultsMap[instanceKey] = accumulated
                } else {
                    const result = await service.translate(textToTranslate, sourceLanguage, effectiveTarget, instanceConfig)
                    resultsMap[instanceKey] = result
                    if (useTranslateStore.getState().requestId === id) {
                        setResult(instanceKey, result)
                    }
                }
            } catch {
                resultsMap[instanceKey] = null
                if (useTranslateStore.getState().requestId === id) {
                    setResult(instanceKey, null)
                }
            }
        })

        await Promise.allSettled(promises)
        if (useTranslateStore.getState().requestId === id) {
            setIsTranslating(false)
        }

        if (!historyDisable) {
            const successKeys = Object.entries(resultsMap).filter(([, r]) => r !== null)
            await Promise.all(successKeys.map(([instanceKey, result]) => {
                const targetText = typeof result === 'string'
                    ? result
                    : (result as DictResult).definitions.map((d) => d.meanings.join('; ')).join('\n')
                return window.electronAPI.history.add({
                    service_key: instanceKey,
                    source_text: textToTranslate,
                    source_lang: sourceLanguage,
                    target_text: targetText,
                    target_lang: effectiveTarget
                }).catch(() => {})
            }))
        }

        if (autoCopy !== 'disable') {
            if (autoCopy === 'source' || autoCopy === 'source_target') {
                navigator.clipboard.writeText(textToTranslate)
            }
            if (autoCopy === 'target' || autoCopy === 'source_target') {
                const targetTexts = Object.values(resultsMap)
                    .filter((r): r is string | DictResult => r !== null)
                    .map((r) => typeof r === 'string' ? r : r.definitions.map((d) => d.meanings.join('; ')).join('\n'))
                    .join('\n')
                if (targetTexts) navigator.clipboard.writeText(targetTexts)
            }
        }
    }, [sourceLanguage, targetLanguage, detectedLanguage, serviceList, serviceInstances, setIsTranslating, setResult, clearResults, nextRequestId, setDetectedLanguage, secondLanguage, autoCopy])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateFromSelection((text: string) => {
            if (!text.trim()) return

            const processed = deleteNewline ? text.replace(/-\s+/g, '').replace(/\s+/g, ' ') : text
            const currentText = useTranslateStore.getState().sourceText
            const nextText = incrementalTranslate && currentText ? `${currentText} ${processed}` : processed

            setSourceText(nextText)
            setForceShowSource(false)
            setTimeout(() => handleTranslate(nextText), 0)
        })
        return unsub
    }, [deleteNewline, incrementalTranslate, setSourceText, handleTranslate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateFromApi((text: string) => {
            if (!text.trim()) return
            setSourceText(text)
            setForceShowSource(false)
            setTimeout(() => handleTranslate(text), 0)
        })
        return unsub
    }, [setSourceText, handleTranslate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateFromClipboard((text: string) => {
            if (!text.trim()) return
            setSourceText(text)
            setForceShowSource(false)
            setTimeout(() => handleTranslate(), 0)
        })
        return unsub
    }, [setSourceText, handleTranslate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onInputTranslate(() => {
            setSourceText('')
            setForceShowSource(true)
            setDetectedLanguage(null)
            clearResults()
            setTimeout(() => inputRef.current?.focus(), 50)
        })
        return unsub
    }, [setSourceText, setDetectedLanguage, clearResults])

    useEffect(() => {
        if (!closeOnBlur) return
        const handleBlur = () => window.electronAPI.window.close()
        window.addEventListener('blur', handleBlur)
        return () => window.removeEventListener('blur', handleBlur)
    }, [closeOnBlur])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') window.electronAPI.window.close()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleClose = useCallback(() => window.electronAPI.window.close(), [])

    const handleToggleAlwaysOnTop = useCallback(() => {
        window.electronAPI.window.setAlwaysOnTop(!alwaysOnTop)
    }, [alwaysOnTop])

    const handleRetry = useCallback(async (instanceKey: string) => {
        const textToTranslate = useTranslateStore.getState().sourceText
        if (!textToTranslate.trim()) return

        const serviceKey = getServiceKey(instanceKey)
        const service = translateServiceRegistry.get(serviceKey)
        if (!service) return

        const instanceConfig = serviceInstances[instanceKey]?.config ?? {}
        const detected = sourceLanguage === 'auto' ? await detectLanguage(textToTranslate, useConfigStore.getState().config.translate_detect_engine) : null

        let effectiveTarget = targetLanguage
        if (sourceLanguage === 'auto' && detected && detected === targetLanguage) {
            effectiveTarget = secondLanguage as LanguageCode
        }

        try {
            const result = await service.translate(textToTranslate, sourceLanguage, effectiveTarget, instanceConfig)
            setResult(instanceKey, result)
        } catch {
            setResult(instanceKey, null)
        }
    }, [sourceLanguage, targetLanguage, secondLanguage, serviceInstances, setResult])

    const showSource = forceShowSource || !hideSource

    return (
        <div
            className="op-window"
            style={{ fontSize: appFontSize, fontFamily: appFont === 'default' ? undefined : appFont }}
        >
            {/* Titlebar — Pin left, wordmark, mode, spacer, close */}
            <div className="op-titlebar">
                <button
                    className="ic-btn"
                    title="置顶"
                    onClick={handleToggleAlwaysOnTop}
                    style={{ color: alwaysOnTop ? 'var(--brand-primary)' : 'var(--text-mute)' }}
                >
                    <Icons.Pin size={14} fill={alwaysOnTop} />
                </button>
                <div className="op-wordmark" style={{ marginLeft: 2 }}>
                    <span className="dot" style={{ background: 'var(--brand-primary)' }} />
                    omni_pot
                </div>
                <span className="op-mode">· 翻译</span>
                <div style={{ flex: 1 }} />
                <button className="ic-btn" title="关闭" onClick={handleClose}>
                    <Icons.Close size={14} />
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {showSource && <SourceArea onTranslate={handleTranslate} inputRef={inputRef} />}
                <LanguageArea />
                <TargetArea serviceList={serviceList} ttsServiceList={ttsServiceList} onRetry={handleRetry} />
            </div>
        </div>
    )
}
