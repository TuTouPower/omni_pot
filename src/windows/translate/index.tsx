import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Titlebar } from '../../components/titlebar'
import { SourceArea } from './source_area'
import { LanguageArea } from './language_area'
import { TargetArea } from './target_area'
import { useTranslateStore } from '../../stores/translate_store'
import { useConfigStore } from '../../stores/config_store'
import { translateServiceRegistry } from '../../services/registry'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { detectLanguage } from '../../services/detect'
import { getServiceKey } from '@shared/types/service'
import { create_logger } from '../../utils/logger'
import type { DictResult } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { log_error, get_service_config, normalize_source_text } from './translate_helpers'
import { use_source_tts } from './use_source_tts'
import { use_translate_height_reporting } from './use_translate_height_reporting'

const log = create_logger('translate')

export default function TranslateWindow(): React.ReactElement {
    const { t } = useTranslation()
    const sourceText = useTranslateStore((s) => s.sourceText)
    const results = useTranslateStore((s) => s.results)
    const isTranslating = useTranslateStore((s) => s.isTranslating)
    const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)
    const targetLanguage = useTranslateStore((s) => s.targetLanguage)
    const detectedLanguage = useTranslateStore((s) => s.detectedLanguage)
    const effectiveTargetLanguage = useTranslateStore((s) => s.effectiveTargetLanguage)
    const lockedTargetLanguage = useTranslateStore((s) => s.lockedTargetLanguage)
    const setIsTranslating = useTranslateStore((s) => s.setIsTranslating)
    const setResult = useTranslateStore((s) => s.setResult)
    const clearResults = useTranslateStore((s) => s.clearResults)
    const setSourceText = useTranslateStore((s) => s.setSourceText)
    const setDetectedLanguage = useTranslateStore((s) => s.setDetectedLanguage)
    const setEffectiveTargetLanguage = useTranslateStore((s) => s.setEffectiveTargetLanguage)
    const setLockedTargetLanguage = useTranslateStore((s) => s.setLockedTargetLanguage)
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
        if (configTargetLang) {
            setStoreTargetLang(configTargetLang as LanguageCode)
        }
        if (configSourceLang) {
            setStoreSourceLang(configSourceLang as LanguageCode)
        }
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

    const [forceShowSource, setForceShowSource] = useState(false)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const retryRequestRef = useRef<Record<string, number>>({})
    const translate_timer_ref = useRef<number | null>(null)
    const previousLanguagesRef = useRef({ sourceLanguage, targetLanguage })

    const handleTranslate = useCallback(async (textOverride?: string) => {
        const storeAtEntry = useTranslateStore.getState()
        const textToTranslate = textOverride ?? storeAtEntry.sourceText
        if (!textToTranslate.trim()) return
        log.info('[handleTranslate] ENTRY closure src=%s target=%s locked=%s | store src=%s target=%s locked=%s text=%j override=%j', sourceLanguage, targetLanguage, lockedTargetLanguage ?? '-', storeAtEntry.sourceLanguage, storeAtEntry.targetLanguage, storeAtEntry.lockedTargetLanguage ?? '-', storeAtEntry.sourceText.slice(0, 30), textOverride?.slice(0, 30) ?? null)
        log.info('[handleTranslate] config secondLanguage=%s services=[%s]', secondLanguage, enabledServiceList.join(','))

        const id = nextRequestId()
        setIsTranslating(true)
        clearResults()
        setDetectedLanguage(null)
        setEffectiveTargetLanguage(null)

        const detected = sourceLanguage === 'auto' ? await detectLanguage(textToTranslate) : null
        if (useTranslateStore.getState().requestId !== id) {
            log.info('[handleTranslate] BAIL after detect: requestId changed (was %d now %d)', id, useTranslateStore.getState().requestId)
            return
        }
        if (detected) {
            log.info('[handleTranslate] detected=%s', detected)
            setDetectedLanguage(detected)
        }

        let effectiveTarget = lockedTargetLanguage ?? targetLanguage
        const fallbackEligible = !lockedTargetLanguage && sourceLanguage === 'auto' && detected !== null && detected === targetLanguage
        log.info('[handleTranslate] fallback check: locked=%s src=%s detected=%s target=%s -> eligible=%s', lockedTargetLanguage ?? '-', sourceLanguage, detected ?? '-', targetLanguage, String(fallbackEligible))
        if (fallbackEligible) {
            effectiveTarget = secondLanguage as LanguageCode
            log.info('[handleTranslate] fallback APPLIED → effective=%s (second=%s)', effectiveTarget, secondLanguage)
        }
        const effectiveSource: LanguageCode = (sourceLanguage === 'auto' && detected) ? detected : sourceLanguage
        log.info('[handleTranslate] RESOLVED effectiveSource=%s effectiveTarget=%s (src=%s target=%s locked=%s detected=%s) — will send to %d services',
            effectiveSource, effectiveTarget, sourceLanguage, targetLanguage, lockedTargetLanguage ?? '-', detected ?? '-', enabledServiceList.length)
        setEffectiveTargetLanguage(effectiveTarget === targetLanguage ? null : effectiveTarget)
        if (!lockedTargetLanguage && effectiveTarget !== targetLanguage) {
            log.info('[handleTranslate] setLocked(%s) — first fallback for this text', effectiveTarget)
            setLockedTargetLanguage(effectiveTarget)
        }

        const resultsMap: Record<string, string | DictResult | null> = {}
        const promises = enabledServiceList.map(async (instanceKey) => {
            const serviceKey = getServiceKey(instanceKey)
            const service = translateServiceRegistry.get(serviceKey)
            if (!service) {
                log.warn('[service:%s] not found in registry (serviceKey=%s)', instanceKey, serviceKey)
                resultsMap[instanceKey] = null
                if (useTranslateStore.getState().requestId === id) {
                    setResult(instanceKey, null)
                }
                return
            }
            const instanceConfig = get_service_config(serviceInstances, instanceKey)
            log.info('[service:%s] CALL service=%s from=%s(orig=%s) to=%s text=%j config=%j',
                instanceKey, serviceKey, effectiveSource, sourceLanguage, effectiveTarget,
                textToTranslate.slice(0, 30), instanceConfig)

            try {
                if (service.translateStream) {
                    let accumulated = ''
                    let lastUpdateTime = 0
                    for await (const chunk of service.translateStream(textToTranslate, effectiveSource, effectiveTarget, instanceConfig)) {
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
                    log.info('[service:%s] RESULT stream len=%d preview=%j', instanceKey, accumulated.length, accumulated.slice(0, 60))
                } else {
                    const result = await service.translate(textToTranslate, effectiveSource, effectiveTarget, instanceConfig)
                    resultsMap[instanceKey] = result
                    if (useTranslateStore.getState().requestId === id) {
                        setResult(instanceKey, result)
                    }
                    const previewStr = typeof result === 'string'
                        ? result.slice(0, 60)
                        : JSON.stringify(result).slice(0, 120)
                    log.info('[service:%s] RESULT type=%s preview=%j', instanceKey, typeof result, previewStr)
                }
            } catch (err) {
                log.error('[service:%s] FAILED: %s', instanceKey, err instanceof Error ? err.stack ?? err.message : String(err))
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
                    source_lang: effectiveSource,
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
    }, [sourceLanguage, targetLanguage, lockedTargetLanguage, enabledServiceList, serviceInstances, setIsTranslating, setResult, clearResults, nextRequestId, setDetectedLanguage, setEffectiveTargetLanguage, setLockedTargetLanguage, secondLanguage, autoCopy, historyDisable])

    useEffect(() => {
        const previous = previousLanguagesRef.current
        previousLanguagesRef.current = { sourceLanguage, targetLanguage }
        if (!languageConfigReadyRef.current || !sourceText.trim()) return
        if (previous.sourceLanguage === sourceLanguage && previous.targetLanguage === targetLanguage) return
        handleTranslate().catch((err: unknown) => { log_error('translate', err) })
    }, [sourceLanguage, targetLanguage, sourceText, handleTranslate])

    const cancel_scheduled_translate = useCallback(() => {
        if (translate_timer_ref.current === null) return
        window.clearTimeout(translate_timer_ref.current)
        translate_timer_ref.current = null
    }, [])

    const schedule_translate = useCallback((text: string) => {
        cancel_scheduled_translate()
        const snap = useTranslateStore.getState()
        log.info('[schedule_translate] queued text=%j | store src=%s target=%s locked=%s',
            text.slice(0, 30), snap.sourceLanguage, snap.targetLanguage, snap.lockedTargetLanguage ?? '-')
        translate_timer_ref.current = window.setTimeout(() => {
            translate_timer_ref.current = null
            const snap2 = useTranslateStore.getState()
            log.info('[schedule_translate] FIRE text=%j | store src=%s target=%s locked=%s',
                text.slice(0, 30), snap2.sourceLanguage, snap2.targetLanguage, snap2.lockedTargetLanguage ?? '-')
            handleTranslate(text).catch((err: unknown) => { log_error('translate', err) })
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
            log.info('[ipc:onTranslateFromSelection] recv text=%j', text.slice(0, 30))
            if (!text.trim()) return
            const nextText = prepareIncomingText(text)
            setSourceText(nextText)
            setForceShowSource(false)
            schedule_translate(nextText)
        })
        return unsub
    }, [prepareIncomingText, setSourceText, schedule_translate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateSelectionEmpty(() => {
            log.info('[ipc:onTranslateSelectionEmpty]')
            cancel_scheduled_translate()
            setSourceText('')
            setDetectedLanguage(null)
            clearResults()
        })
        return unsub
    }, [cancel_scheduled_translate, setSourceText, setDetectedLanguage, clearResults])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateFromApi((text: string) => {
            log.info('[ipc:onTranslateFromApi] recv text=%j', text.slice(0, 30))
            if (!text.trim()) return
            const nextText = prepareIncomingText(text)
            setSourceText(nextText)
            setForceShowSource(false)
            schedule_translate(nextText)
        })
        return unsub
    }, [prepareIncomingText, setSourceText, schedule_translate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onTranslateFromClipboard((text: string) => {
            log.info('[ipc:onTranslateFromClipboard] recv text=%j', text.slice(0, 30))
            if (!text.trim()) return
            const nextText = prepareIncomingText(text)
            setSourceText(nextText)
            setForceShowSource(false)
            schedule_translate(nextText)
        })
        return unsub
    }, [prepareIncomingText, setSourceText, schedule_translate])

    useEffect(() => {
        const unsub = window.electronAPI.text.onInputTranslate(() => {
            cancel_scheduled_translate()
            setSourceText('')
            setForceShowSource(true)
            setDetectedLanguage(null)
            clearResults()
            setTimeout(() => inputRef.current?.focus(), 50)
        })
        return unsub
    }, [cancel_scheduled_translate, setSourceText, setDetectedLanguage, clearResults])

    const showSource = forceShowSource || !hideSource

    useEffect(() => {
        window.electronAPI.ready('translate')
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') window.electronAPI.window.close().catch((err: unknown) => { log_error('close window', err) })
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => { window.removeEventListener('keydown', handleKeyDown); }
    }, [])

    const handleClose = useCallback(() => window.electronAPI.window.close(), [])

    const handleTogglePin = useCallback(() => { setConfig('translate_pinned', !configPinned) }, [configPinned, setConfig])

    const handleToggleAlwaysOnTop = useCallback(() => {
        const next = !alwaysOnTop
        window.electronAPI.window.setAlwaysOnTop(next)
            .then(() => { setConfig('translate_always_on_top', next) })
            .catch((err: unknown) => { log_error('set always on top', err) })
    }, [alwaysOnTop, setConfig])

    const handleSwapLanguages = useCallback(() => { swapLanguages(secondLanguage as LanguageCode) }, [secondLanguage, swapLanguages])

    const { sourceTtsBusy, sourceTtsPlaying, handleSourceTts } = use_source_tts(enabledTtsServiceList, cancel_scheduled_translate)
    const { titlebar_ref, top_ref, language_ref, results_scroll_ref, results_content_ref } = use_translate_height_reporting(
        showSource, hideLanguage, enabledServiceList.length, isTranslating,
        appFont, appFontSize, results,
        sourceLanguage, targetLanguage, detectedLanguage, effectiveTargetLanguage
    )

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
        const effectiveSource: LanguageCode = (retrySourceLanguage === 'auto' && detected) ? detected : retrySourceLanguage

        try {
            const result = await service.translate(textToTranslate, effectiveSource, effectiveTarget, instanceConfig)
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

    const sourceTtsInstanceKey = enabledTtsServiceList[0]
    const sourceTtsAvailable = sourceTtsInstanceKey ? !!ttsServiceRegistry.get(getServiceKey(sourceTtsInstanceKey)) : false
    const handle_source_translate = useCallback(() => { handleTranslate().catch((err: unknown) => { log_error('translate', err) }); }, [handleTranslate])

    return (
        <div
            ref={undefined}
            className="op-window"
            style={{
                fontSize: appFontSize,
                fontFamily: appFont === 'default' ? undefined : appFont,
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                overflow: 'hidden',
            }}
        >
            <Titlebar
                alwaysOnTop={alwaysOnTop}
                pinned={pinned}
                onToggleTopmost={handleToggleAlwaysOnTop}
                onTogglePin={handleTogglePin}
                modeLabel={t('translate')}
                onClose={() => { handleClose().catch((err: unknown) => { log_error('close window', err) }); }}
                containerRef={titlebar_ref}
            />

            <div
                ref={top_ref}
                style={{ flex: '0 0 auto', padding: '4px 10px 0', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
                {showSource && (
                    <SourceArea
                        onTranslate={handle_source_translate}
                        onTts={() => { handleSourceTts().catch((err: unknown) => { log_error('source tts', err) }); }}
                        ttsAvailable={sourceTtsAvailable}
                        ttsBusy={sourceTtsBusy}
                        ttsPlaying={sourceTtsPlaying}
                        onDetectedLanguageClick={handleSwapLanguages}
                        onClearResults={clearResults}
                        inputRef={inputRef}
                    />
                )}
                {!hideLanguage && <LanguageArea onSwap={handleSwapLanguages} containerRef={language_ref} />}
            </div>

            <div
                ref={results_scroll_ref}
                className="thin-scroll"
                data-testid="translate-results-scroll"
                style={{
                    flex: '1 1 auto',
                    minHeight: 0,
                    overflowY: 'auto',
                    padding: '8px 10px 12px',
                }}
            >
                <div ref={results_content_ref}>
                    <TargetArea
                        serviceList={enabledServiceList}
                        ttsServiceList={enabledTtsServiceList}
                        hasAnyRequest={isTranslating || Object.keys(results).length > 0}
                        onRetry={(instanceKey) => { handleRetry(instanceKey).catch((err: unknown) => { log_error('retry translate service', err) }); }}
                    />
                </div>
            </div>
        </div>
    )
}
