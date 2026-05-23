export interface FreeDictionaryDefinitionPayload {
    definition: string
    example?: string
}

export interface FreeDictionaryMeaningPayload {
    partOfSpeech: string
    definitions: FreeDictionaryDefinitionPayload[]
}

export interface FreeDictionaryEntryPayload {
    word: string
    phonetic?: string
    phonetics?: Array<{ text?: string; audio?: string }>
    meanings: FreeDictionaryMeaningPayload[]
}

export const free_dictionary_hello_payload: FreeDictionaryEntryPayload[] = [{
    word: 'hello',
    phonetic: '/həˈləʊ/',
    phonetics: [{ text: '/həˈloʊ/', audio: 'https://example.test/hello-us.mp3' }],
    meanings: [{
        partOfSpeech: 'noun',
        definitions: [{
            definition: 'A greeting or expression of goodwill.',
            example: 'She said hello to everyone in the room.',
        }],
    }],
}]

export const free_dictionary_run_payload: FreeDictionaryEntryPayload[] = [{
    word: 'run',
    phonetic: '/rʌn/',
    phonetics: [{ text: '/rʌn/' }],
    meanings: [
        {
            partOfSpeech: 'verb',
            definitions: [
                { definition: 'Move at a speed faster than a walk.' },
                { definition: 'Manage or operate something.' },
            ],
        },
        {
            partOfSpeech: 'noun',
            definitions: [
                { definition: 'An act or spell of running.' },
                { definition: 'A continuous stretch or sequence.' },
            ],
        },
        {
            partOfSpeech: 'adjective',
            definitions: [
                { definition: 'Flowing or current.' },
            ],
        },
    ],
}]

export const free_dictionary_reconcile_payload: FreeDictionaryEntryPayload[] = [{
    word: 'reconcile',
    phonetic: '/ˈrekənsaɪl/',
    phonetics: [{ text: '/ˈrekənsaɪl/' }],
    meanings: [{
        partOfSpeech: 'verb',
        definitions: [{
            definition: 'Restore friendly relations between people or groups.',
        }],
    }],
}]

export function baidu_ocr_token_payload(): { access_token: string; expires_in: number } {
    return { access_token: 'e2e-token', expires_in: 3600 }
}

export function baidu_ocr_words_payload(words: string): { words_result: Array<{ words: string }> } {
    return { words_result: [{ words }] }
}

function input_url(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input
    if (input instanceof URL) return input.toString()
    return input.url
}

function safe_json(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replaceAll(String.fromCharCode(0x2028), '\\u2028')
        .replaceAll(String.fromCharCode(0x2029), '\\u2029')
}

export function create_free_dictionary_fetch(
    original_fetch: typeof fetch,
    payload_by_word: Partial<Record<string, FreeDictionaryEntryPayload[]>> = { hello: free_dictionary_hello_payload },
): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = input_url(input)
        const prefix = 'https://api.dictionaryapi.dev/api/v2/entries/en/'
        if (url.startsWith(prefix)) {
            const word = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0] ?? '').toLowerCase()
            const payload = payload_by_word[word]
            return new Response(JSON.stringify(payload ?? []), {
                status: payload ? 200 : 404,
                headers: { 'content-type': 'application/json' },
            })
        }
        return original_fetch(input, init)
    }
}

export function build_free_dictionary_init_script(payload_by_word: Partial<Record<string, FreeDictionaryEntryPayload[]>> = { hello: free_dictionary_hello_payload }): string {
    const payload_json = safe_json(payload_by_word)
    return `
(() => {
    const payload_by_word = ${payload_json}
    const input_url = (input) => {
        if (typeof input === 'string') return input
        if (input instanceof URL) return input.toString()
        return input.url
    }
    const original_fetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
        const url = input_url(input)
        const prefix = 'https://api.dictionaryapi.dev/api/v2/entries/en/'
        if (url.startsWith(prefix)) {
            const word = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0] ?? '').toLowerCase()
            const payload = payload_by_word[word]
            return new Response(JSON.stringify(payload ?? []), {
                status: payload ? 200 : 404,
                headers: { 'content-type': 'application/json' },
            })
        }
        return original_fetch(input, init)
    }
})()
`
}
