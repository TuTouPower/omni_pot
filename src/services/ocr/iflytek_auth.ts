import { hmac, sha256, hexToBase64 } from '@/lib/crypto'

export async function iflytek_auth(
    api_key: string,
    api_secret: string,
    host: string,
    date: string,
    request_line: string
): Promise<string> {
    const signature_origin = `host: ${host}\ndate: ${date}\n${request_line}`
    const signature_hex = await hmac(api_secret, signature_origin, 'SHA-256')
    const signature = hexToBase64(signature_hex)
    const authorization_origin =
        `api_key="${api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
    return btoa(authorization_origin)
}

export async function iflytek_intsig_auth(
    api_key: string,
    api_secret: string,
    host: string,
    date: string,
    request_line: string,
    body_json: string
): Promise<string> {
    const body_hash_hex = await sha256(body_json)
    const body_hash_b64 = hexToBase64(body_hash_hex)
    const digest = `SHA-256=${body_hash_b64}`
    const signature_origin = `host: ${host}\ndate: ${date}\n${request_line}\nDigest: ${digest}`
    const signature_hex = await hmac(api_secret, signature_origin, 'SHA-256')
    const signature = hexToBase64(signature_hex)
    return `api_key="${api_key}", algorithm="hmac-sha256", headers="host date request-line Digest", signature="${signature}"`
}
