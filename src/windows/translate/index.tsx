import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icons } from '../../components/icons'
import { SourceArea } from './source_area'
import { LanguageArea } from './language_area'
import { TargetArea } from './target_area'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { detectLanguage } from '../../services/detect'
import { getServiceKey } from '@shared/types/service'
import type { DictResult, ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import type { LanguageCode } from '@shared/types/language'

function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

function normalize_source_text(text: string): string {
    return text.replace(/-\s+/g, '').replace(/\s+/g, ' ')
}

export default function TranslateWindow(): React.ReactElement {
    const sourceText = useTranslateStore((s) => s.sourceText)
    const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
    const targetLanguage = useTranslateStore((s) => s.targetLanguage)
    const setIsTranslating = useTranslateStore((s) => s.setIsTranslating)
    const setResult = useTranslateStore((s) => s.setResult)
    const clearResults = useTranslateStore((s) => s.clearResults)
    const setSourceText = useTranslateStore((s) => s.setSourceText)
    const setDetectedLanguage = useTranslateStore((s) => s.setDetectedLanguage)
    const nextRequestId = useTranslateStore((s) => s.nextRequestId)

    const serviceList = useConfigStore((s) => s.config.translate_service_list)
    const serviceInstances = useConfigStore((s) => s.config.service_instances)
    const enabledServiceList = useMemo(
        () => serviceList.filter((instanceKey) => get_service_config(serviceInstances, instanceKey).enable !== false),
        [serviceList, serviceInstances]
    )
    const alwaysOnTop = useConfigStore((s) => s.config.translate_always_on_top)
    const secondLanguage = useConfigStore((s) => s.config.translate_second_language)
    const incrementalTranslate = useConfigStore((s) => s.config.incremental_translate)
    const deleteNewline = useConfigStore((s) => s.config.translate_delete_newline)
    const autoCopy = useConfigStore((s) => s.config.translate_auto_copy)
    const hideSource = useConfigStore((s) => s.config.hide_source)
    const hideLanguage = useConfigStore((s) => s.config.hide_language)
    const historyDisable = useConfigStore((s) => s.config.history_disable)
    const ttsServiceList = useConfigStore((s) => s.config.tts_service_list)
    const enabledTtsServiceList = useMemo(
        () => ttsServiceList.filter((instanceKey) => get_service_config(serviceInstances, instanceKey).enable !== false),
        [ttsServiceList, serviceInstances]
    )
    const configTargetLang = useConfigStore((s) => s.config.translate_target_language)
    const configSourceLang = useConfigStore((s) => s.config.translate_source_language)
    const rememberLanguage = useConfigStore((s) => s.config.translate_remember_language)
    const appFont = useConfigStore((s) => s.config.app_font)
    const appFontSize = useConfigStore((s) => s.config.app_font_size)
    const setConfig = useConfigStore((s) => s.set)
    const setStoreTargetLang = useTranslateStore((s) => s.setTargetLanguage)
    const setStoreSourceLang = useTranslateStore((s) => s.setSourceLanguage)
    const swapLanguages = useTranslateStore((s) => s.swapLanguages)

    const languageConfigReadyRef = useRef(false)

    useEffect(() => {
        setStoreTargetLang(configTargetLang as LanguageCode)
        setStoreSourceLang(configSourceLang as LanguageCode)
        const timer = window.setTimeout(() => { languageConfigReadyRef.current = true }, 0)
        return () => { window.clearTimeout(timer); }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!rememberLanguage || !languageConfigReadyRef.current) return
        if (configSourceLang !== sourceLanguage) {
            setConfig('translate_source_language', sourceLanguage)
        }
        if (configTargetLang !== targetLanguage) {
            setConfig('translate_target_language', targetLanguage)
        }
    }, [rememberLanguage, sourceLanguage, targetLanguage, configSourceLang, configTargetLang, setConfig])

    const [forceShowSource, setForceShowSource] = useState(false)
    const [sourceTtsBusy, setSourceTtsBusy] = useState(false)
    const [sourceTtsPlaying, setSourceTtsPlaying] = useState(false)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const sourceAudioRef = useRef<HTMLAudioElement | null>(null)
    const sourceAudioCleanupRef = useRef<(() => void) | null>(null)
    const sourceTtsBusyRef = useRef(false)
    const sourceTtsMountedRef = useRef(true)
    const sourceTtsRequestRef = useRef(0)
    const sourceTtsTextRef = useRef('')
    const sourceTtsLanguageRef = useRef<LanguageCode | null>(null)
    const retryRequestRef = useRef<Record<string, number>>({})

    const handleTranslate = useCallback(async (textOverride?: string) => {
        const textToTranslate = textOverride ?? useTranslateStore.getState().sourceText
        if (!textToTranslate.trim()) return

        const id = nextRequestId()
        setIsTranslating(true)
        clearResults()
        setDetectedLanguage(null)

        const detected = sourceLanguage === 'auto' ? await detectLanguage(textToTranslate, useConfigStore.getState().config.translate_detect_engine) : null
        if (useTranslateStore.getState().requestId !== id) return
        if (detected) setDetectedLanguage(detected)

        let effectiveTarget = targetLanguage
        if (sourceLanguage === 'auto' && detected && detected === targetLanguage) {
            effectiveTarget = secondLanguage as LanguageCode
        }

        const resultsMap: Record<string, string | DictResult | null> = {}

        const promises = enabledServiceList.map(async (instanceKey) => {
            const serviceKey = getServiceKey(instanceKey)
            const service = translateServiceRegistry.get(serviceKey)
            if (!service) {
                resultsMap[instanceKey] = null
                if (useTranslateStore.getState().requestId === id) {
                    setResult(instanceKey, null)
                }
                return
            }
            const instanceConfig = get_service_config(serviceInstances, instanceKey)

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

        const isActiveRequest = () => {
            const state = useTranslateStore.getState()
            return state.requestId === id
                && state.sourceText === textToTranslate
                && state.sourceLanguage === sourceLanguage
                && state.targetLanguage === targetLanguage
        }

        await Promise.allSettled(promises)
        if (!isActiveRequest()) return
        setIsTranslating(false)

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
            if (!isActiveRequest()) return
        }

        if (autoCopy !== 'disable') {
            if (!isActiveRequest()) return
            const targetTexts = Object.values(resultsMap)
                .filter((r): r is string | DictResult => r !== null)
                .map((r) => typeof r === 'string' ? r : r.definitions.map((d) => d.meanings.join('; ')).join('\n'))
                .join('\n')
            let clipboardText = ''
            if (autoCopy === 'source') {
                clipboardText = textToTranslate
            } else if (autoCopy === 'target') {
                clipboardText = targetTexts
            } else {
                clipboardText = targetTexts ? `${textToTranslate}\n\n${targetTexts}` : textToTranslate
            }
            if (clipboardText) navigator.clipboard.writeText(clipboardText).catch(() => undefined)
        }
    }, [sourceLanguage, targetLanguage, enabledServiceList, serviceInstances, setIsTranslating, setResult, clearResults, nextRequestId, setDetectedLanguage, secondLanguage, autoCopy, historyDisable])

    const prepareIncomingText = useCallback((text: string) => {
        const trimmed = text.trim()
        const processed = deleteNewline ? normalize_source_text(trimmed) : trimmed
        const currentText = useTranslateStore.getState().sourceText
        return incrementalTranslate && currentText ? `${currentText} ${processed}` : processed
    }, [deleteNewline, incrementalTranslate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateFromSelection((text: string) => {
            if (!text.trim()) return

            const nextText = prepareIncomingText(text)

            setSourceText(nextText)
            setForceShowSource(false)
            setTimeout(() => { handleTranslate(nextText).catch(console.error) }, 0)
        })
        return unsub
    }, [prepareIncomingText, setSourceText, handleTranslate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateFromApi((text: string) => {
            if (!text.trim()) return
            const nextText = prepareIncomingText(text)
            setSourceText(nextText)
            setForceShowSource(false)
            setTimeout(() => { handleTranslate(nextText).catch(console.error) }, 0)
        })
        return unsub
    }, [prepareIncomingText, setSourceText, handleTranslate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateFromClipboard((text: string) => {
            if (!text.trim()) return
            const nextText = prepareIncomingText(text)
            setSourceText(nextText)
            setForceShowSource(false)
            setTimeout(() => { handleTranslate(nextText).catch(console.error) }, 0)
        })
        return unsub
    }, [prepareIncomingText, setSourceText, handleTranslate])

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
        window.electronAPI.ready('translate')
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') window.electronAPI.window.close().catch(console.error)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => { window.removeEventListener('keydown', handleKeyDown); }
    }, [])

    const handleClose = useCallback(() => window.electronAPI.window.close(), [])

    const handleToggleAlwaysOnTop = useCallback(() => {
        const next = !alwaysOnTop
        window.electronAPI.window.setAlwaysOnTop(next).catch(console.error)
            .then(() => { setConfig('translate_always_on_top', next); })
            .catch(() => undefined)
    }, [alwaysOnTop, setConfig])

    const handleSwapLanguages = useCallback(() => {
        swapLanguages(secondLanguage as LanguageCode)
    }, [secondLanguage, swapLanguages])

    const cancelSourceTts = useCallback(() => {
        sourceTtsRequestRef.current += 1
        sourceAudioRef.current?.pause()
        sourceAudioCleanupRef.current?.()
        sourceAudioRef.current = null
        sourceAudioCleanupRef.current = null
        sourceTtsTextRef.current = ''
        sourceTtsLanguageRef.current = null
        sourceTtsBusyRef.current = false
        setSourceTtsBusy(false)
        setSourceTtsPlaying(false)
    }, [])

    const handleSourceTts = useCallback(async () => {
        const text = useTranslateStore.getState().sourceText.trim()
        if (!text) return

        if (sourceTtsPlaying || sourceTtsBusyRef.current || sourceAudioRef.current) {
            cancelSourceTts()
            return
        }

        const instanceKey = enabledTtsServiceList[0]
        if (!instanceKey) return

        const serviceKey = getServiceKey(instanceKey)
        const ttsService = ttsServiceRegistry.get(serviceKey)
        if (!ttsService) return

        const requestId = sourceTtsRequestRef.current + 1
        sourceTtsRequestRef.current = requestId
        sourceTtsTextRef.current = text
        sourceTtsBusyRef.current = true
        setSourceTtsBusy(true)

        try {
            const { sourceLanguage: currentSourceLanguage, sourceText: currentSourceText } = useTranslateStore.getState()
            const isCurrentSourceTtsRequest = () => {
                const state = useTranslateStore.getState()
                return sourceTtsMountedRef.current
                    && sourceTtsRequestRef.current === requestId
                    && state.sourceText.trim() === text
                    && state.sourceLanguage === currentSourceLanguage
            }
            if (currentSourceText.trim() !== text) return
            sourceTtsLanguageRef.current = currentSourceLanguage

            const config = useConfigStore.getState().config
            const language = currentSourceLanguage === 'auto'
                ? await detectLanguage(text, config.translate_detect_engine)
                : currentSourceLanguage
            if (!isCurrentSourceTtsRequest()) return
            const instanceConfig = get_service_config(config.service_instances, instanceKey)

            const audioBuffer = await ttsService.synthesize(text, language, instanceConfig)
            if (!isCurrentSourceTtsRequest()) return

            const blob = new Blob([audioBuffer], { type: 'audio/mp3' })
            const url = URL.createObjectURL(blob)
            const audio = new Audio(url)
            const cleanup = () => {
                if (sourceAudioRef.current === audio) {
                    sourceAudioRef.current = null
                }
                if (sourceAudioCleanupRef.current === cleanup) {
                    sourceAudioCleanupRef.current = null
                }
                if (sourceTtsTextRef.current === text) {
                    sourceTtsTextRef.current = ''
                }
                if (sourceTtsLanguageRef.current === currentSourceLanguage) {
                    sourceTtsLanguageRef.current = null
                }
                if (sourceTtsMountedRef.current && sourceTtsRequestRef.current === requestId) {
                    setSourceTtsPlaying(false)
                }
                URL.revokeObjectURL(url)
            }
            sourceAudioRef.current = audio
            sourceAudioCleanupRef.current = cleanup
            audio.onended = cleanup
            audio.onerror = cleanup
            setSourceTtsBusy(false)
            setSourceTtsPlaying(true)
            audio.play().catch(cleanup)
        } catch {
            if (sourceTtsMountedRef.current && sourceTtsRequestRef.current === requestId) {
                sourceAudioRef.current = null
                sourceTtsTextRef.current = ''
                sourceTtsLanguageRef.current = null
                setSourceTtsPlaying(false)
            }
        } finally {
            if (sourceTtsMountedRef.current && sourceTtsRequestRef.current === requestId) {
                sourceTtsBusyRef.current = false
                setSourceTtsBusy(false)
            }
        }
    }, [sourceTtsPlaying, enabledTtsServiceList, cancelSourceTts])

    useEffect(() => {
        const spokenText = sourceTtsTextRef.current
        const spokenLanguage = sourceTtsLanguageRef.current
        if (!spokenText) return
        if (spokenText === sourceText.trim() && spokenLanguage === sourceLanguage) return
        cancelSourceTts()
    }, [sourceText, sourceLanguage, cancelSourceTts])

    useEffect(() => {
        return () => {
            sourceTtsMountedRef.current = false
            sourceTtsRequestRef.current += 1
            sourceTtsBusyRef.current = false
            sourceTtsTextRef.current = ''
            sourceTtsLanguageRef.current = null
            sourceAudioRef.current?.pause()
            sourceAudioCleanupRef.current?.()
        }
    }, [])

    const handleRetry = useCallback(async (instanceKey: string) => {
        const {
            requestId: retryRequestId,
            sourceText: textToTranslate,
            sourceLanguage: retrySourceLanguage,
            targetLanguage: retryTargetLanguage
        } = useTranslateStore.getState()
        if (!textToTranslate.trim()) return

        const retryAttempt = (retryRequestRef.current[instanceKey] ?? 0) + 1
        retryRequestRef.current[instanceKey] = retryAttempt

        const isCurrentRetry = () => {
            const state = useTranslateStore.getState()
            return retryRequestRef.current[instanceKey] === retryAttempt
                && state.requestId === retryRequestId
                && state.sourceText === textToTranslate
                && state.sourceLanguage === retrySourceLanguage
                && state.targetLanguage === retryTargetLanguage
        }

        const serviceKey = getServiceKey(instanceKey)
        const service = translateServiceRegistry.get(serviceKey)
        if (!service) return

        const instanceConfig = get_service_config(serviceInstances, instanceKey)
        const detected = retrySourceLanguage === 'auto' ? await detectLanguage(textToTranslate, useConfigStore.getState().config.translate_detect_engine) : null
        if (!isCurrentRetry()) return

        let effectiveTarget = retryTargetLanguage
        if (retrySourceLanguage === 'auto' && detected && detected === retryTargetLanguage) {
            effectiveTarget = secondLanguage as LanguageCode
        }

        try {
            const result = await service.translate(textToTranslate, retrySourceLanguage, effectiveTarget, instanceConfig)
            if (isCurrentRetry()) {
                setResult(instanceKey, result)
            }
        } catch {
            if (isCurrentRetry()) {
                setResult(instanceKey, null)
            }
        }
    }, [secondLanguage, serviceInstances, setResult])

    const sourceTtsInstanceKey = enabledTtsServiceList[0]
    const sourceTtsAvailable = sourceTtsInstanceKey ? !!ttsServiceRegistry.get(getServiceKey(sourceTtsInstanceKey)) : false
    const showSource = forceShowSource || !hideSource

    return (
        <div
            className="op-window"
            style={{ fontSize: appFontSize, fontFamily: appFont === 'default' ? undefined : appFont }}
        >
            {/* Titlebar — Pin left, wordmark, mode, spacer, close */}
            <div className="op-titlebar" data-testid="titlebar">
                <button
                    className="ic-btn"
                    title="置顶"
                    data-testid="titlebar-pin"
                    aria-pressed={alwaysOnTop}
                    onClick={() => { handleToggleAlwaysOnTop(); }}
                    style={{ color: alwaysOnTop ? 'var(--brand-primary)' : 'var(--text-mute)' }}
                >
                    <Icons.Pin size={14} fill={alwaysOnTop} />
                </button>
                <div className="op-wordmark" style={{ marginLeft: 2 }} data-testid="titlebar-wordmark">
                    <span className="dot" style={{ background: 'var(--brand-primary)' }} />
                    omni_pot
                </div>
                <span className="op-mode" data-testid="titlebar-mode">· 翻译</span>
                <div style={{ flex: 1 }} />
                <button className="ic-btn" title="关闭" data-testid="titlebar-close" onClick={() => { handleClose().catch(console.error); }}>
                    <Icons.Close size={14} />
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {showSource && (
                    <SourceArea
                        onTranslate={() => { handleTranslate().catch(console.error); }}
                        onTts={() => { handleSourceTts().catch(console.error); }}
                        ttsAvailable={sourceTtsAvailable}
                        ttsBusy={sourceTtsBusy}
                        ttsPlaying={sourceTtsPlaying}
                        onDetectedLanguageClick={handleSwapLanguages}
                        inputRef={inputRef}
                    />
                )}
                {!hideLanguage && <LanguageArea onSwap={handleSwapLanguages} />}
                <TargetArea serviceList={enabledServiceList} ttsServiceList={enabledTtsServiceList} onRetry={(instanceKey) => { handleRetry(instanceKey).catch(console.error); }} />
            </div>
        </div>
    )
}
