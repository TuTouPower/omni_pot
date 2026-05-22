import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Titlebar } from '../../components/titlebar'
import { SourceArea } from './source_area'
import { LanguageArea } from './language_area'
import { TargetArea } from './target_area'
import WelcomeEmpty from './welcome_empty'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { detectLanguage } from '../../services/detect'
import { getServiceKey } from '@shared/types/service'
import { create_logger } from '../../utils/logger'
import type { DictResult, ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import type { LanguageCode } from '@shared/types/language'

const log = create_logger('translate')

function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

function normalize_source_text(text: string): string {
    return text.replace(/-\s+/g, '').replace(/\s+/g, ' ')
}

export default function TranslateWindow(): React.ReactElement {
    const { t } = useTranslation()
    const sourceText = useTranslateStore((s) => s.sourceText)
    const results = useTranslateStore((s) => s.results)
    const isTranslating = useTranslateStore((s) => s.isTranslating)
    const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
    const targetLanguage = useTranslateStore((s) => s.targetLanguage)
    const setIsTranslating = useTranslateStore((s) => s.setIsTranslating)
    const setResult = useTranslateStore((s) => s.setResult)
    const clearResults = useTranslateStore((s) => s.clearResults)
    const setSourceText = useTranslateStore((s) => s.setSourceText)
    const setDetectedLanguage = useTranslateStore((s) => s.setDetectedLanguage)
    const setEffectiveTargetLanguage = useTranslateStore((s) => s.setEffectiveTargetLanguage)
    const nextRequestId = useTranslateStore((s) => s.nextRequestId)

    const serviceList = useConfigStore((s) => s.config.translate_service_list)
    const serviceInstances = useConfigStore((s) => s.config.service_instances)
    const enabledServiceList = useMemo(
        () => serviceList.filter((instanceKey) => get_service_config(serviceInstances, instanceKey).enable !== false),
        [serviceList, serviceInstances]
    )
    const alwaysOnTop = useConfigStore((s) => s.config.translate_always_on_top)
    const configPinned = useConfigStore((s) => s.config.translate_pinned)
    const pinned = configPinned || alwaysOnTop
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
    const appFont = useConfigStore((s) => s.config.app_font)
    const appFontSize = useConfigStore((s) => s.config.app_font_size)
    const setConfig = useConfigStore((s) => s.set)
    const setStoreTargetLang = useTranslateStore((s) => s.setTargetLanguage)
    const setStoreSourceLang = useTranslateStore((s) => s.setSourceLanguage)
    const swapLanguages = useTranslateStore((s) => s.swapLanguages)

    const languageConfigReadyRef = useRef(false)
    const configSourceLangRef = useRef(configSourceLang)
    const configTargetLangRef = useRef(configTargetLang)

    useEffect(() => {
        setStoreTargetLang(configTargetLang as LanguageCode)
        setStoreSourceLang(configSourceLang as LanguageCode)
        const timer = window.setTimeout(() => { languageConfigReadyRef.current = true }, 0)
        return () => { window.clearTimeout(timer); }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (configSourceLangRef.current === configSourceLang) return
        configSourceLangRef.current = configSourceLang
        if (sourceLanguage !== configSourceLang) {
            setStoreSourceLang(configSourceLang as LanguageCode)
        }
    }, [configSourceLang, sourceLanguage, setStoreSourceLang])

    useEffect(() => {
        if (configTargetLangRef.current === configTargetLang) return
        configTargetLangRef.current = configTargetLang
        if (targetLanguage !== configTargetLang) {
            setStoreTargetLang(configTargetLang as LanguageCode)
        }
    }, [configTargetLang, targetLanguage, setStoreTargetLang])

    const welcomeDismissed = useConfigStore((s) => s.config.welcome_dismissed)
    const [forceShowSource, setForceShowSource] = useState(false)
    const [selection_notice, setSelectionNotice] = useState(false)
    const [sourceTtsBusy, setSourceTtsBusy] = useState(false)
    const [sourceTtsPlaying, setSourceTtsPlaying] = useState(false)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const sourceAudioCleanupRef = useRef<(() => void) | null>(null)
    const sourceTtsBusyRef = useRef(false)
    const sourceTtsMountedRef = useRef(true)
    const sourceTtsRequestRef = useRef(0)
    const sourceTtsTextRef = useRef('')
    const sourceTtsLanguageRef = useRef<LanguageCode | null>(null)
    const retryRequestRef = useRef<Record<string, number>>({})
    const root_ref = useRef<HTMLDivElement>(null)
    const titlebar_ref = useRef<HTMLDivElement>(null)
    const content_ref = useRef<HTMLDivElement>(null)
    const translate_timer_ref = useRef<number | null>(null)
    const previousLanguagesRef = useRef({ sourceLanguage, targetLanguage })
    const result_fit_key = useMemo(
        () => Object.entries(results).map(([key, result]) => {
            if (result === null) return `${key}:error`
            if (typeof result === 'string') return `${key}:text:${result.length.toString()}`
            return `${key}:dict:${result.definitions.length.toString()}:${result.examples.length.toString()}`
        }).join('|'),
        [results]
    )

    const handleTranslate = useCallback(async (textOverride?: string) => {
        const textToTranslate = textOverride ?? useTranslateStore.getState().sourceText
        if (!textToTranslate.trim()) return

        log.info('translate start: src=%s→%s, text=%s, services=%d',
            sourceLanguage, targetLanguage, textToTranslate.slice(0, 50), enabledServiceList.length)

        const id = nextRequestId()
        setIsTranslating(true)
        clearResults()
        setDetectedLanguage(null)
        setEffectiveTargetLanguage(null)

        const detected = sourceLanguage === 'auto' ? await detectLanguage(textToTranslate) : null
        if (useTranslateStore.getState().requestId !== id) return
        if (detected) {
            log.info('detected language: %s', detected)
            setDetectedLanguage(detected)
        }

        let effectiveTarget = targetLanguage
        if (sourceLanguage === 'auto' && detected && detected === targetLanguage) {
            effectiveTarget = secondLanguage as LanguageCode
        }
        setEffectiveTargetLanguage(effectiveTarget === targetLanguage ? null : effectiveTarget)

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
            } catch (err) {
                log.error('service %s failed: %s', instanceKey, err instanceof Error ? err.message : String(err))
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
                && state.effectiveTargetLanguage === (effectiveTarget === targetLanguage ? null : effectiveTarget)
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

        if (autoCopy) {
            if (!isActiveRequest()) return
            const clipboardText = Object.values(resultsMap)
                .filter((r): r is string | DictResult => r !== null)
                .map((r) => typeof r === 'string' ? r : r.definitions.map((d) => d.meanings.join('; ')).join('\n'))
                .join('\n')
            if (clipboardText) window.electronAPI.text.writeClipboard(clipboardText).catch(() => undefined)
        }
    }, [sourceLanguage, targetLanguage, enabledServiceList, serviceInstances, setIsTranslating, setResult, clearResults, nextRequestId, setDetectedLanguage, setEffectiveTargetLanguage, secondLanguage, autoCopy, historyDisable])

    useEffect(() => {
        const previous = previousLanguagesRef.current
        previousLanguagesRef.current = { sourceLanguage, targetLanguage }
        if (!languageConfigReadyRef.current || !sourceText.trim()) return
        if (previous.sourceLanguage === sourceLanguage && previous.targetLanguage === targetLanguage) return
        handleTranslate().catch(console.error)
    }, [sourceLanguage, targetLanguage, sourceText, handleTranslate])

    const cancel_scheduled_translate = useCallback(() => {
        if (translate_timer_ref.current === null) return
        window.clearTimeout(translate_timer_ref.current)
        translate_timer_ref.current = null
    }, [])

    const schedule_translate = useCallback((text: string) => {
        cancel_scheduled_translate()
        translate_timer_ref.current = window.setTimeout(() => {
            translate_timer_ref.current = null
            handleTranslate(text).catch(console.error)
        }, 0)
    }, [cancel_scheduled_translate, handleTranslate])

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

            setSelectionNotice(false)
            setSourceText(nextText)
            setForceShowSource(false)
            schedule_translate(nextText)
        })
        return unsub
    }, [prepareIncomingText, setSourceText, schedule_translate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateSelectionEmpty(() => {
            cancel_scheduled_translate()
            setSelectionNotice(true)
            setSourceText('')
            setDetectedLanguage(null)
            clearResults()
        })
        return unsub
    }, [cancel_scheduled_translate, setSourceText, setDetectedLanguage, clearResults])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateFromApi((text: string) => {
            if (!text.trim()) return
            const nextText = prepareIncomingText(text)
            setSelectionNotice(false)
            setSourceText(nextText)
            setForceShowSource(false)
            schedule_translate(nextText)
        })
        return unsub
    }, [prepareIncomingText, setSourceText, schedule_translate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateFromClipboard((text: string) => {
            if (!text.trim()) return
            const nextText = prepareIncomingText(text)
            setSelectionNotice(false)
            setSourceText(nextText)
            setForceShowSource(false)
            schedule_translate(nextText)
        })
        return unsub
    }, [prepareIncomingText, setSourceText, schedule_translate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onInputTranslate(() => {
            cancel_scheduled_translate()
            setSelectionNotice(false)
            setSourceText('')
            setForceShowSource(true)
            setDetectedLanguage(null)
            clearResults()
            setTimeout(() => inputRef.current?.focus(), 50)
        })
        return unsub
    }, [cancel_scheduled_translate, setSourceText, setDetectedLanguage, clearResults])

    const showSource = forceShowSource || !hideSource
    const show_welcome_empty = sourceText.trim() === '' && !forceShowSource && !welcomeDismissed && !selection_notice

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

    const handleTogglePin = useCallback(() => {
        setConfig('translate_pinned', !configPinned)
    }, [configPinned, setConfig])

    const handleToggleAlwaysOnTop = useCallback(() => {
        const next = !alwaysOnTop
        window.electronAPI.window.setAlwaysOnTop(next)
            .then(() => {
                setConfig('translate_always_on_top', next)
            })
            .catch(console.error)
    }, [alwaysOnTop, setConfig])

    const handleSwapLanguages = useCallback(() => {
        swapLanguages(secondLanguage as LanguageCode)
    }, [secondLanguage, swapLanguages])

    const cancelSourceTts = useCallback(() => {
        sourceTtsRequestRef.current += 1
        sourceAudioCleanupRef.current?.()
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

        if (sourceTtsPlaying || sourceTtsBusyRef.current || sourceAudioCleanupRef.current) {
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
                ? await detectLanguage(text)
                : currentSourceLanguage
            if (!isCurrentSourceTtsRequest()) return
            const instanceConfig = get_service_config(config.service_instances, instanceKey)

            const handle = ttsService.play(text, language, instanceConfig)
            const cleanup = (): void => {
                if (sourceAudioCleanupRef.current === cleanup) {
                    sourceAudioCleanupRef.current = null
                }
                if (sourceTtsTextRef.current === text) sourceTtsTextRef.current = ''
                if (sourceTtsLanguageRef.current === currentSourceLanguage) sourceTtsLanguageRef.current = null
                if (sourceTtsMountedRef.current && sourceTtsRequestRef.current === requestId) {
                    setSourceTtsPlaying(false)
                }
            }
            sourceAudioCleanupRef.current = () => { handle.stop(); cleanup() }
            setSourceTtsBusy(false)
            setSourceTtsPlaying(true)
            handle.done.then(cleanup, cleanup)
        } catch {
            if (sourceTtsMountedRef.current && sourceTtsRequestRef.current === requestId) {
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
            cancel_scheduled_translate()
            sourceAudioCleanupRef.current?.()
        }
    }, [cancel_scheduled_translate])

    const handleRetry = useCallback(async (instanceKey: string) => {
        const {
            requestId: retryRequestId,
            sourceText: textToTranslate,
            sourceLanguage: retrySourceLanguage,
            targetLanguage: retryTargetLanguage,
            effectiveTargetLanguage: retryEffectiveTargetLanguage
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
                && state.effectiveTargetLanguage === retryEffectiveTargetLanguage
        }

        const serviceKey = getServiceKey(instanceKey)
        const service = translateServiceRegistry.get(serviceKey)
        if (!service) return

        if (!isCurrentRetry()) return

        useTranslateStore.setState((state) => {
            const results = Object.fromEntries(
                Object.entries(state.results).filter(([key]) => key !== instanceKey)
            )
            return { results, isTranslating: true }
        })

        const instanceConfig = get_service_config(serviceInstances, instanceKey)
        const detected = retrySourceLanguage === 'auto' ? await detectLanguage(textToTranslate) : null
        if (!isCurrentRetry()) return

        let effectiveTarget = retryEffectiveTargetLanguage ?? retryTargetLanguage
        if (!retryEffectiveTargetLanguage && retrySourceLanguage === 'auto' && detected && detected === retryTargetLanguage) {
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
        } finally {
            if (isCurrentRetry()) {
                setIsTranslating(false)
            }
        }
    }, [secondLanguage, serviceInstances, setIsTranslating, setResult])

    useEffect(() => {
        const root = root_ref.current
        const titlebar = titlebar_ref.current
        const content = content_ref.current
        if (!root || !titlebar || !content) return

        let frame_id = 0
        const fit_height = (): void => {
            window.cancelAnimationFrame(frame_id)
            frame_id = window.requestAnimationFrame(() => {
                const root_style = getComputedStyle(root)
                const root_padding = (Number.parseFloat(root_style.paddingTop) || 0) + (Number.parseFloat(root_style.paddingBottom) || 0)
                const height = Math.ceil(titlebar.getBoundingClientRect().height + content.scrollHeight + root_padding)
                if (Math.abs(window.innerHeight - height) <= 1) return
                window.electronAPI.window.setContentHeight(height).catch(() => undefined)
            })
        }

        fit_height()
        const observer = new ResizeObserver(fit_height)
        observer.observe(titlebar)
        observer.observe(content)
        return () => {
            window.cancelAnimationFrame(frame_id)
            observer.disconnect()
        }
    }, [show_welcome_empty, showSource, hideLanguage, enabledServiceList.length, sourceText, result_fit_key, isTranslating, appFont, appFontSize])

    const sourceTtsInstanceKey = enabledTtsServiceList[0]
    const sourceTtsAvailable = sourceTtsInstanceKey ? !!ttsServiceRegistry.get(getServiceKey(sourceTtsInstanceKey)) : false
    const handle_source_translate = useCallback(() => { handleTranslate().catch(console.error); }, [handleTranslate])

    return (
        <div
            ref={root_ref}
            className="op-window"
            style={{ fontSize: appFontSize, fontFamily: appFont === 'default' ? undefined : appFont }}
        >
            <Titlebar
                alwaysOnTop={alwaysOnTop}
                pinned={pinned}
                onToggleTopmost={handleToggleAlwaysOnTop}
                onTogglePin={handleTogglePin}
                modeLabel={t('translate')}
                onClose={() => { handleClose().catch(console.error); }}
                containerRef={titlebar_ref}
            />

            {/* Content */}
            <div ref={content_ref} style={{ flex: '0 1 auto', overflow: 'auto', padding: '4px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {showSource && !show_welcome_empty && (
                    <SourceArea
                        onTranslate={handle_source_translate}
                        onTts={() => { handleSourceTts().catch(console.error); }}
                        ttsAvailable={sourceTtsAvailable}
                        ttsBusy={sourceTtsBusy}
                        ttsPlaying={sourceTtsPlaying}
                        onDetectedLanguageClick={handleSwapLanguages}
                        inputRef={inputRef}
                    />
                )}
                {selection_notice && (
                    <div className="card" data-testid="selection-empty-notice" style={{ padding: '12px 14px', color: 'var(--text-dim)', fontSize: 13 }}>
                        {t('selection.no_text')}
                    </div>
                )}
                {!hideLanguage && !show_welcome_empty && <LanguageArea onSwap={handleSwapLanguages} />}
                {show_welcome_empty && (
                    <WelcomeEmpty onSkip={() => { setConfig('welcome_dismissed', true); window.electronAPI.window.close().catch(console.error); }} />
                )}
                {!show_welcome_empty && (
                    <TargetArea serviceList={enabledServiceList} ttsServiceList={enabledTtsServiceList} onRetry={(instanceKey) => { handleRetry(instanceKey).catch(console.error); }} />
                )}
            </div>
        </div>
    )
}
