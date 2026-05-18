import type { LanguageCode } from './language'

/**
 * Handle returned by a direct-playback TTS service. Callers use `stop()` to
 * interrupt playback and `done` to await natural completion.
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
     * Synthesize speech into a downloadable audio buffer. Used by services that
     * return a real audio stream (e.g. Edge TTS, Lingva TTS). Renderer code
     * wraps the buffer in an HTMLAudio element for playback.
     */
    synthesize?(text: string, language: LanguageCode, config: Record<string, unknown>): Promise<ArrayBuffer>
    /**
     * Speak directly through the host platform's audio output. Used by services
     * that cannot expose a decoded buffer (e.g. Web Speech API / OS TTS).
     * Renderer code prefers `play` over `synthesize` when both exist.
     */
    play?(text: string, language: LanguageCode, config: Record<string, unknown>): TtsPlaybackHandle
    testConfig(config: Record<string, unknown>): Promise<boolean>
}
