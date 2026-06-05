import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfigStore } from '../../stores/config_store'
import { useTranslateStore } from '../../stores/translate_store'
import { ttsServiceRegistry } from '../../services/tts_registry'
import { detectLanguage } from '../../services/detect'
import { getServiceKey } from '@shared/types/service'
import type { LanguageCode } from '@shared/types/language'
import { get_service_config } from './translate_helpers'

export function use_source_tts(
    enabled_tts_service_list: string[],
    cancel_scheduled_translate: () => void
): {
    sourceTtsBusy: boolean
    sourceTtsPlaying: boolean
    cancelSourceTts: () => void
    handleSourceTts: () => Promise<void>
} {
    const [sourceTtsBusy, setSourceTtsBusy] = useState(false)
    const [sourceTtsPlaying, setSourceTtsPlaying] = useState(false)
    const sourceAudioCleanupRef = useRef<(() => void) | null>(null)
    const sourceTtsBusyRef = useRef(false)
    const sourceTtsMountedRef = useRef(true)
    const sourceTtsRequestRef = useRef(0)
    const sourceTtsTextRef = useRef('')
    const sourceTtsLanguageRef = useRef<LanguageCode | null>(null)

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

        const instanceKey = enabled_tts_service_list[0]
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
    }, [sourceTtsPlaying, enabled_tts_service_list, cancelSourceTts])

    const sourceText = useTranslateStore((s) => s.sourceText)
    const sourceLanguage = useTranslateStore((s) => s.sourceLanguage)

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

    return { sourceTtsBusy, sourceTtsPlaying, cancelSourceTts, handleSourceTts }
}
