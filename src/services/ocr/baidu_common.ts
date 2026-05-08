const tokenCache = new Map<string, { token: string; expiresAt: number }>()

export async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const cacheKey = `${clientId}:${clientSecret}`
    const cached = tokenCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) return cached.token

    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`
    const resp = await fetch(url)
    if (!resp.ok) {
        throw new Error(`Baidu OCR token error: ${resp.status}`)
    }
    const data = (await resp.json()) as { access_token?: string; expires_in?: number; error?: string }
    if (!data.access_token) {
        throw new Error(`Baidu OCR token error: ${data.error ?? 'unknown'}`)
    }

    const ttl = (data.expires_in ?? 2592000) * 1000
    tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttl - 86400000 })
    return data.access_token
}
