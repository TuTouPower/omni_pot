import type { Page } from '@playwright/test'
import { local_translation_timeout_ms, tts_timeout_ms } from '../fixtures/timeout_constants'

/** @stubbed Page-level fetch interceptor for Lingva. Prefer TranslationTestServer for new tests. */
export async function hold_lingva_translation_once(page: Page, translation: string): Promise<{ wait_for_request: () => Promise<void>; release_response: () => Promise<void> }> {
    await page.evaluate((translation_text: string) => {
        type E2eWindow = Window & {
            __e2e_lingva_request_seen?: boolean
            __e2e_lingva_release?: () => void
        }
        const e2e_window = window as E2eWindow
        const original_fetch = window.fetch.bind(window)
        let consumed = false
        const release_promise = new Promise<void>((resolve) => {
            e2e_window.__e2e_lingva_release = resolve
        })
        e2e_window.__e2e_lingva_request_seen = false
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
            if (!consumed && url.includes('/api/v1/') && !url.includes('/api/v1/audio/')) {
                consumed = true
                e2e_window.__e2e_lingva_request_seen = true
                await release_promise
                return new Response(JSON.stringify({ translation: translation_text }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }
            return original_fetch(input, init)
        }
    }, translation)

    return {
        wait_for_request: async () => {
            await page.waitForFunction(() => {
                return Boolean((window as Window & { __e2e_lingva_request_seen?: boolean }).__e2e_lingva_request_seen)
            }, undefined, { timeout: local_translation_timeout_ms })
        },
        release_response: () => page.evaluate(() => {
            ;(window as Window & { __e2e_lingva_release?: () => void }).__e2e_lingva_release?.()
        }).then(() => undefined),
    }
}

/** @stubbed Page-level fetch interceptor. Prefer TranslationTestServer for new tests. */
export async function fail_then_succeed_lingva_translation_once(page: Page, translation: string): Promise<void> {
    await page.evaluate((translation_text: string) => {
        const original_fetch = window.fetch.bind(window)
        let request_count = 0
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
            if (url.includes('/api/v1/') && !url.includes('/api/v1/audio/')) {
                request_count += 1
                if (request_count === 1) {
                    return new Response(JSON.stringify({ error: 'e2e translation failure' }), {
                        status: 500,
                        headers: { 'content-type': 'application/json' },
                    })
                }
                return new Response(JSON.stringify({ translation: translation_text }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }
            return original_fetch(input, init)
        }
    }, translation)
}

/** @stubbed Page-level fetch interceptor. No longer used by converted tests; prefer TranslationTestServer. */
export async function fulfill_lingva_translation_once(page: Page, translation: string, target_language = 'zh'): Promise<void> {
    await page.evaluate(({ translation_text, target_language_code }) => {
        const original_fetch = window.fetch.bind(window)
        let consumed = false
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
            if (!consumed && url.includes('/api/v1/') && !url.includes('/api/v1/audio/') && url.includes(`/${target_language_code}/`)) {
                consumed = true
                return new Response(JSON.stringify({ translation: translation_text }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }
            return original_fetch(input, init)
        }
    }, { translation_text: translation, target_language_code: target_language })
}

/** @stubbed Page-level fetch interceptor. No longer used by converted tests; prefer TranslationTestServer. */
export async function fulfill_mymemory_translation_once(page: Page, translation: string): Promise<void> {
    await page.evaluate((translation_text: string) => {
        const original_fetch = window.fetch.bind(window)
        let consumed = false
        const mock_body = JSON.stringify({ responseData: { translatedText: translation_text }, responseStatus: 200 })
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
            if (!consumed && url.startsWith('https://api.mymemory.translated.net/get')) {
                consumed = true
                return new Response(mock_body, { status: 200, headers: { 'content-type': 'application/json' } })
            }
            return original_fetch(input, init)
        }
    }, translation)
}

export async function hold_lingva_tts(page: Page): Promise<{ wait_for_request: () => Promise<void>; wait_for_request_count: (expected_count: number) => Promise<void>; release_response: () => Promise<void> }> {
    await page.evaluate(() => {
        type E2eWindow = Window & {
            __e2e_lingva_tts_request_count?: number
            __e2e_lingva_tts_release?: () => void
        }
        const e2e_window = window as E2eWindow
        const original_fetch = window.fetch.bind(window)
        const release_promise = new Promise<void>((resolve) => {
            e2e_window.__e2e_lingva_tts_release = resolve
        })
        e2e_window.__e2e_lingva_tts_request_count = 0
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
            if (url.includes('/api/v1/audio/')) {
                e2e_window.__e2e_lingva_tts_request_count = (e2e_window.__e2e_lingva_tts_request_count ?? 0) + 1
                await release_promise
                return new Response(JSON.stringify({ audio: [1, 2, 3] }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }
            return original_fetch(input, init)
        }
    })

    return {
        wait_for_request: async () => {
            await page.waitForFunction(() => {
                return ((window as Window & { __e2e_lingva_tts_request_count?: number }).__e2e_lingva_tts_request_count ?? 0) > 0
            }, undefined, { timeout: tts_timeout_ms })
        },
        wait_for_request_count: async (expected_count: number) => {
            const end = Date.now() + 1_000
            while (Date.now() < end) {
                const request_count = await page.evaluate(() => {
                    return ((window as Window & { __e2e_lingva_tts_request_count?: number }).__e2e_lingva_tts_request_count ?? 0)
                })
                if (request_count !== expected_count) {
                    throw new Error(`Expected ${String(expected_count)} Lingva TTS request(s), got ${String(request_count)}`)
                }
                const delay = Math.min(50, end - Date.now())
                if (delay > 0) await page.waitForTimeout(delay)
            }
        },
        release_response: () => page.evaluate(() => {
            ;(window as Window & { __e2e_lingva_tts_release?: () => void }).__e2e_lingva_tts_release?.()
        }).then(() => undefined),
    }
}
