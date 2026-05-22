import type { TtsService, TtsPlaybackHandle } from '@shared/types/tts_service'
import type { LanguageCode } from '@shared/types/language'
import { create_logger } from '../../utils/logger'

const log = create_logger('tts')

/**
 * System TTS — speaks through the host's built-in speech synthesizer using the
 * browser-provided Web Speech API. This means Windows uses SAPI, macOS uses
 * NSSpeechSynthesizer, Linux uses espeak/festival. Zero configuration, no
 * network, no API key. Quality varies by OS but it always works offline.
 */

const SYSTEM_TTS_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'nb_no', 'nn_no', 'fa', 'sv', 'pl', 'nl', 'uk', 'he',
]

const LANG_TAG_MAP: Record<string, string> = {
    auto: 'en-US',
    zh_cn: 'zh-CN',
    zh_tw: 'zh-TW',
    yue: 'zh-HK',
    pt_pt: 'pt-PT',
    pt_br: 'pt-BR',
    nb_no: 'nb-NO',
    nn_no: 'nb-NO',
}

function to_bcp47(language: LanguageCode): string {
    return LANG_TAG_MAP[language] ?? language.replace('_', '-')
}

function pick_voice(lang_tag: string): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) return null
    const lower = lang_tag.toLowerCase()
    const prefix = lower.split('-')[0] ?? lower
    const exact = voices.find((v) => v.lang.toLowerCase() === lower)
    if (exact) return exact
    const prefix_match = voices.find((v) => v.lang.toLowerCase().startsWith(`${prefix}-`))
    if (prefix_match) return prefix_match
    return voices[0] ?? null
}

function wait_for_voices(timeout_ms = 1500): Promise<void> {
    return new Promise((resolve) => {
        if (window.speechSynthesis.getVoices().length > 0) {
            resolve()
            return
        }
        let done = false
        const finish = (): void => {
            if (done) return
            done = true
            window.speechSynthesis.removeEventListener('voiceschanged', finish)
            resolve()
        }
        window.speechSynthesis.addEventListener('voiceschanged', finish)
        setTimeout(finish, timeout_ms)
    })
}

function assign_voice(utterance: SpeechSynthesisUtterance, voice: SpeechSynthesisVoice): void {
    try {
        utterance.voice = voice
    } catch {
        // Some Web Speech implementations expose voice-like objects that cannot be assigned.
    }
}

export const systemTtsService: TtsService = {
    key: 'system_tts',
    name: 'System TTS',
    languages: SYSTEM_TTS_LANGUAGES,

    play(text: string, language: LanguageCode): TtsPlaybackHandle {
        log.info('play: lang=%s, text=%s', language, text.slice(0, 50))
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = to_bcp47(language)
        const initial_voice = pick_voice(utterance.lang)
        if (initial_voice) assign_voice(utterance, initial_voice)

        let resolve_done: (() => void) | null = null
        const done = new Promise<void>((res) => { resolve_done = res })

        const cleanup = (): void => {
            utterance.onend = null
            utterance.onerror = null
            resolve_done?.()
        }
        utterance.onend = cleanup
        utterance.onerror = (ev) => {
            log.error('playback error: %s', (ev as SpeechSynthesisErrorEvent).error ?? 'unknown')
            cleanup()
        }

        // Voices may load asynchronously on first use; wait briefly if empty.
        if (!initial_voice) {
            wait_for_voices().then(() => {
                const v = pick_voice(utterance.lang)
                if (v) assign_voice(utterance, v)
                window.speechSynthesis.cancel()
                window.speechSynthesis.speak(utterance)
            }).catch(() => undefined)
        } else {
            window.speechSynthesis.cancel()
            window.speechSynthesis.speak(utterance)
        }

        return {
            stop: () => {
                window.speechSynthesis.cancel()
                cleanup()
            },
            done,
        }
    },

    async testConfig(): Promise<boolean> {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
        await wait_for_voices()
        return window.speechSynthesis.getVoices().length > 0
    },
}
