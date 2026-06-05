export interface CambridgeDefinitionPayload {
    part_of_speech: string
    definition: string
    example?: string
    phonetic?: string
    audio?: string
}

export type CambridgePayloadByWord = Partial<Record<string, CambridgeDefinitionPayload[]>>

export const cambridge_dict_hello_payload: CambridgeDefinitionPayload[] = [{
    part_of_speech: 'noun',
    definition: 'A greeting or expression of goodwill.',
    example: 'She said hello to everyone in the room.',
    phonetic: 'həˈləʊ',
    audio: '/media/english/uk_pron/u/ukh/ukhel/ukhello.mp3',
}]

export const cambridge_dict_run_payload: CambridgeDefinitionPayload[] = [
    { part_of_speech: 'verb', definition: 'Move at a speed faster than a walk.', phonetic: 'rʌn' },
    { part_of_speech: 'verb', definition: 'Manage or operate something.' },
    { part_of_speech: 'noun', definition: 'An act or spell of running.' },
]

export const cambridge_dict_reconcile_payload: CambridgeDefinitionPayload[] = [{
    part_of_speech: 'verb',
    definition: 'Restore friendly relations between people or groups.',
    phonetic: 'ˈrekənsaɪl',
}]

export function baidu_ocr_token_payload(): { access_token: string; expires_in: number } {
    return { access_token: 'e2e-token', expires_in: 3600 }
}

export function baidu_ocr_words_payload(words: string): { words_result: Array<{ words: string }> } {
    return { words_result: [{ words }] }
}

function safe_json(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replaceAll(String.fromCharCode(0x2028), '\\u2028')
        .replaceAll(String.fromCharCode(0x2029), '\\u2029')
}

export function build_cambridge_dict_init_script(payload_by_word: CambridgePayloadByWord = { hello: cambridge_dict_hello_payload }): string {
    const payload_json = safe_json(payload_by_word)
    return `
(() => {
    const payload_by_word = ${payload_json}
    const escape_html = (text) => String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    const render_entry = (entry) => {
        const audio = entry.audio ? '<source type="audio/mpeg" src="' + escape_html(entry.audio) + '">' : ''
        const pron = entry.phonetic ? '<span class="dpron-i"><span><span class="region">UK</span><span class="ipa">' + escape_html(entry.phonetic) + '</span>' + audio + '</span></span>' : ''
        const example = entry.example ? '<div class="examp"><span class="eg">' + escape_html(entry.example) + '</span></div>' : ''
        return '<div class="pr entry-body__el">'
            + pron
            + '<span class="posgram">' + escape_html(entry.part_of_speech) + '</span>'
            + '<div><div><div class="def-block ddef_block ">'
            + '<span class="def ddef_d db">' + escape_html(entry.definition) + '</span>'
            + example
            + '</div></div></div>'
            + '</div>'
    }
    const original_fetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        if (url.startsWith('https://dictionary.cambridge.org/search/direct/')) {
            const query = new URL(url).searchParams.get('q') || ''
            const word = decodeURIComponent(query).toLowerCase()
            const payload = payload_by_word[word]
            if (!payload) return new Response('', { status: 404, headers: { 'content-type': 'text/html' } })
            return new Response(payload.map(render_entry).join(''), {
                status: 200,
                headers: { 'content-type': 'text/html' },
            })
        }
        return original_fetch(input, init)
    }
})()
`
}
