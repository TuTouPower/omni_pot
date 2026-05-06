import type { TtsService } from '@shared/types/tts_service'
import type { LanguageCode } from '@shared/types/language'

const EDGE_TTS_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'yue', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'mn_mo', 'mn_cy', 'km', 'nb_no', 'nn_no', 'fa', 'sv', 'pl',
    'nl', 'uk', 'he'
]

const VOICE_MAP: Record<string, string> = {
    auto: 'en-US-AriaNeural',
    en: 'en-US-AriaNeural',
    zh_cn: 'zh-CN-XiaoxiaoNeural',
    zh_tw: 'zh-TW-HsiaoChenNeural',
    yue: 'zh-HK-WanLungNeural',
    ja: 'ja-JP-NanamiNeural',
    ko: 'ko-KR-SunHiNeural',
    fr: 'fr-FR-DeniseNeural',
    es: 'es-ES-ElviraNeural',
    ru: 'ru-RU-SvetlanaNeural',
    de: 'de-DE-KatjaNeural',
    it: 'it-IT-ElsaNeural',
    tr: 'tr-TR-EmelNeural',
    pt_pt: 'pt-PT-RaquelNeural',
    pt_br: 'pt-BR-FranciscaNeural',
    vi: 'vi-VN-HoaiMyNeural',
    id: 'id-ID-GadisNeural',
    th: 'th-TH-PremwadeeNeural',
    ms: 'ms-MY-YasminNeural',
    ar: 'ar-SA-ZariyahNeural',
    hi: 'hi-IN-SwaraNeural',
    mn_mo: 'mn-MN-YesuiNeural',
    mn_cy: 'mn-MN-YesuiNeural',
    km: 'km-KH-PisethNeural',
    nb_no: 'nb-NO-PernilleNeural',
    nn_no: 'nb-NO-PernilleNeural',
    fa: 'fa-IR-DilaraNeural',
    sv: 'sv-SE-SofieNeural',
    pl: 'pl-PL-AgnieszkaNeural',
    nl: 'nl-NL-ColetteNeural',
    uk: 'uk-UA-PolinaNeural',
    he: 'he-IL-HilaNeural'
}

const LANG_MAP: Record<string, string> = {
    auto: 'en-US',
    zh_cn: 'zh-CN',
    zh_tw: 'zh-TW',
    yue: 'zh-HK',
    pt_pt: 'pt-PT',
    pt_br: 'pt-BR',
    mn_mo: 'mn-MN',
    mn_cy: 'mn-MN',
    nb_no: 'nb-NO',
    nn_no: 'nb-NO'
}

function get_voice(language: LanguageCode, config_voice?: string): string {
    if (config_voice && config_voice !== 'auto') {
        return config_voice
    }
    return VOICE_MAP[language] ?? 'en-US-AriaNeural'
}

function get_ssml_lang(language: LanguageCode): string {
    return LANG_MAP[language] ?? `${language.replace('_', '-')}`
}

function generate_uuid(): string {
    return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, () =>
        Math.floor(Math.random() * 16).toString(16)
    )
}

function build_ssml(text: string, voice: string, lang: string): string {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'><voice name='${voice}'>${escaped}</voice></speak>`
}

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'

interface WsMessage {
    type: string
    data?: string | ArrayBuffer
}

function connect_ws(url: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url)
        ws.binaryType = 'arraybuffer'
        ws.onopen = () => resolve(ws)
        ws.onerror = (e) => reject(new Error(`WebSocket error: ${String(e)}`))
    })
}

function send_message(ws: WebSocket, message: string): void {
    ws.send(message)
}

function receive_messages(ws: WebSocket, done_predicate: (msg: WsMessage) => boolean): Promise<WsMessage[]> {
    return new Promise((resolve, reject) => {
        const messages: WsMessage[] = []
        ws.onmessage = (event) => {
            const msg: WsMessage = typeof event.data === 'string'
                ? { type: 'text', data: event.data }
                : { type: 'binary', data: event.data as ArrayBuffer }
            messages.push(msg)
            if (done_predicate(msg)) {
                resolve(messages)
            }
        }
        ws.onerror = (e) => reject(new Error(`WebSocket error: ${String(e)}`))
    })
}

function close_ws(ws: WebSocket): void {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
    }
}

async function synthesize_ws(text: string, language: LanguageCode, config_voice?: string): Promise<ArrayBuffer> {
    const connection_id = generate_uuid()
    const url = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connection_id}`
    const ws = await connect_ws(url)

    try {
        const voice = get_voice(language, config_voice)
        const ssml_lang = get_ssml_lang(language)
        const ssml = build_ssml(text, voice, ssml_lang)
        const request_id = generate_uuid()

        const config_msg = [
            `X-Timestamp:${new Date().toUTCString()}`,
            'Content-Type:application/json; charset=utf-8',
            `Path:speech.config`,
            '',
            `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
        ].join('\r\n')

        const ssml_msg = [
            `X-RequestId:${request_id}`,
            `X-Timestamp:${new Date().toUTCString()}`,
            'Content-Type:application/ssml+xml',
            `Path:ssml`,
            '',
            ssml
        ].join('\r\n')

        send_message(ws, config_msg)
        send_message(ws, ssml_msg)

        const messages = await receive_messages(ws, (msg) => {
            if (msg.type === 'text' && typeof msg.data === 'string') {
                return msg.data.includes('Path:turn.end')
            }
            return false
        })

        const audio_chunks: ArrayBuffer[] = []
        for (const msg of messages) {
            if (msg.type === 'binary' && msg.data instanceof ArrayBuffer) {
                const view = new DataView(msg.data)
                const header_len = view.getInt16(0)
                if (msg.data.byteLength > header_len + 2) {
                    audio_chunks.push(msg.data.slice(header_len + 2))
                }
            }
        }

        const total_len = audio_chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
        const result = new Uint8Array(total_len)
        let offset = 0
        for (const chunk of audio_chunks) {
            result.set(new Uint8Array(chunk), offset)
            offset += chunk.byteLength
        }
        return result.buffer
    } finally {
        close_ws(ws)
    }
}

export const edgeTtsService: TtsService = {
    key: 'edge_tts',
    name: 'Edge TTS',
    languages: EDGE_TTS_LANGUAGES,

    async synthesize(
        text: string,
        language: LanguageCode,
        config: Record<string, unknown>
    ): Promise<ArrayBuffer> {
        const voice = config.voice as string | undefined
        return synthesize_ws(text, language, voice)
    },

    async testConfig(): Promise<boolean> {
        try {
            const result = await synthesize_ws('hello', 'en')
            return result.byteLength > 0
        } catch {
            return false
        }
    }
}
