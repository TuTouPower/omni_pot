import type { LanguageCode } from './language'

/**
 * Handle returned by a TTS service. Callers use `stop()` to interrupt playback
 * and `done` to await natural completion.
 */
export interface TtsPlaybackHandle {
    stop(): void
    done: Promise<void>
}

export interface TtsService {
    readonly key: string
    readonly name: string
    readonly languages: LanguageCode[]
    /**
     * Speak directly through the host platform's audio output. The current
     * implementation (system_tts) uses the renderer's Web Speech API, which
     * dispatches to Windows SAPI / macOS NSSpeechSynthesizer / Linux espeak.
     */
    play(text: string, language: LanguageCode, config: Record<string, unknown>): TtsPlaybackHandle
    testConfig(config: Record<string, unknown>): Promise<boolean>
}
