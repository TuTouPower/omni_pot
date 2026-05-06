import { useState, useCallback, useRef } from 'react'

export function use_tts() {
    const [is_playing, set_is_playing] = useState(false)
    const audio_ref = useRef<HTMLAudioElement | null>(null)

    const play = useCallback(async (audio_buffer: ArrayBuffer) => {
        stop()
        const blob = new Blob([audio_buffer], { type: 'audio/mp3' })
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio_ref.current = audio
        audio.onended = () => set_is_playing(false)
        set_is_playing(true)
        await audio.play()
    }, [])

    const stop = useCallback(() => {
        if (audio_ref.current) {
            audio_ref.current.pause()
            audio_ref.current = null
        }
        set_is_playing(false)
    }, [])

    return { is_playing, play, stop }
}
