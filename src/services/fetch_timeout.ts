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

    let reject_timeout: (error: Error) => void = () => {}
    const timeout_promise = new Promise<never>((_resolve, reject) => {
        reject_timeout = reject
    })
    const timeout_id = setTimeout(() => {
        const error = new Error(`provider request timeout after ${String(timeout_ms)}ms`)
        reject_timeout(error)
        controller.abort()
    }, timeout_ms)

    try {
        return await Promise.race([
            fetch(input, {
                ...init,
                signal: controller.signal,
            }),
            timeout_promise,
        ])
    } finally {
        clearTimeout(timeout_id)
        init.signal?.removeEventListener('abort', abort_from_init_signal)
    }
}
