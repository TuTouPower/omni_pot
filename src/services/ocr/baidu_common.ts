import type { ServiceConfig } from '@shared/types/service'
import { fetch_with_timeout } from '../fetch_timeout'

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

export async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const cacheKey = `${clientId}:${clientSecret}`
    const cached = tokenCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) return cached.token

    const resp = await fetch_with_timeout('https://aip.baidubce.com/oauth/2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        }),
    })
    if (!resp.ok) {
        throw new Error(`Baidu OCR token error: ${String(resp.status)}`)
    }
    const data = (await resp.json()) as { access_token?: string; expires_in?: number; error?: string }
    if (!data.access_token) {
        throw new Error(`Baidu OCR token error: ${data.error ?? 'unknown'}`)
    }

    const ttl = (data.expires_in ?? 2592000) * 1000
    const safetyMargin = Math.min(86400000, ttl / 10)
    tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttl - safetyMargin })
    return data.access_token
}

export async function recognizeWithBaiduOcr(
    endpoint: string,
    service_name: string,
    base64Image: string,
    language_type: string,
    config: ServiceConfig,
    extra_params: Record<string, string> = {},
): Promise<string> {
    const client_id = config.client_id as string
    const client_secret = config.client_secret as string
    const token = await getAccessToken(client_id, client_secret)
    const body = new URLSearchParams({
        image: base64Image,
        language_type,
        ...extra_params,
    })

    const resp = await fetch_with_timeout(
        `https://aip.baidubce.com/rest/2.0/ocr/v1/${endpoint}?access_token=${token}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        }
    )

    if (!resp.ok) {
        throw new Error(`${service_name} API error: ${String(resp.status)}`)
    }

    const data = (await resp.json()) as {
        words_result?: Array<{ words: string }>
        error_code?: number | string
        error_msg?: string
    }

    if (data.error_code) {
        throw new Error(`${service_name} error: ${String(data.error_msg ?? data.error_code)}`)
    }

    return data.words_result?.map((r) => r.words).join('\n') ?? ''
}
