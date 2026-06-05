export const DEFAULT_PROVIDER_TIMEOUT_MS = 15000

const SSRF_HOSTNAME_RANGES = ['169.254.169.254', 'fd00:', 'fe80:']

function assert_allowed_request_url(url: string): void {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        throw new Error(`Blocked request to invalid URL: ${url}`)
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error(`Blocked request to non-HTTP(S) URL: ${parsed.protocol}//`)
    }
    if (parsed.protocol === 'http:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== '::1') {
        throw new Error(`Blocked insecure HTTP request to non-localhost host: ${parsed.hostname}`)
    }
    if (SSRF_HOSTNAME_RANGES.some((prefix) => parsed.hostname.startsWith(prefix) || parsed.hostname === prefix.replace(/:$/, ''))) {
        throw new Error(`Blocked request to reserved/metadata host: ${parsed.hostname}`)
    }
}

export async function fetch_with_timeout(
    input: RequestInfo | URL,
    init: RequestInit = {},
    timeout_ms = DEFAULT_PROVIDER_TIMEOUT_MS
): Promise<Response> {
    const url_string = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    assert_allowed_request_url(url_string)

    const controller = new AbortController()
    const abort_from_init_signal = (): void => {
        controller.abort()
    }
    if (init.signal?.aborted) {
        abort_from_init_signal()
    } else {
        init.signal?.addEventListener('abort', abort_from_init_signal, { once: true })
    }

    let timed_out = false
    const timeout_id = setTimeout(() => {
        timed_out = true
        controller.abort()
    }, timeout_ms)

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        })
    } catch (error: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- set via setTimeout callback
        if (timed_out) {
            throw new Error(`provider request timeout after ${String(timeout_ms)}ms`)
        }
        throw error
    } finally {
        clearTimeout(timeout_id)
        init.signal?.removeEventListener('abort', abort_from_init_signal)
    }
}
