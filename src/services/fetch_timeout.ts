export const DEFAULT_PROVIDER_TIMEOUT_MS = 15000

export async function fetch_with_timeout(
    input: RequestInfo | URL,
    init: RequestInit = {},
    timeout_ms = DEFAULT_PROVIDER_TIMEOUT_MS
): Promise<Response> {
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
        if (timed_out) {
            throw new Error(`provider request timeout after ${String(timeout_ms)}ms`)
        }
        throw error
    } finally {
        clearTimeout(timeout_id)
        init.signal?.removeEventListener('abort', abort_from_init_signal)
    }
}
