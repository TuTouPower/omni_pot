import { useState, useCallback, useRef } from 'react'

function useTts() {
    const [is_playing, set_is_playing] = useState(false)
    const audio_ref = useRef<HTMLAudioElement | null>(null)

    const stop = useCallback(() => {
        if (audio_ref.current) {
            const src = audio_ref.current.src
            audio_ref.current.pause()
            if (src) URL.revokeObjectURL(src)
            audio_ref.current = null
        }
        set_is_playing(false)
    }, [])

    const play = useCallback(async (audio_buffer: ArrayBuffer) => {
        stop()
        const blob = new Blob([audio_buffer], { type: 'audio/mp3' })
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio_ref.current = audio
        audio.onended = () => {
            URL.revokeObjectURL(url)
            audio_ref.current = null
            set_is_playing(false)
        }
        audio.onerror = () => {
            URL.revokeObjectURL(url)
            audio_ref.current = null
            set_is_playing(false)
        }
        set_is_playing(true)
        await audio.play()
    }, [stop])

    return { is_playing, play, stop }
}

export const use_tts = useTts
