import { hmac, sha256, hexToBytes } from '@/lib/crypto'

interface BuildAuthorizationHeaderOpts {
    algorithm: string
    service: string
    region: string
    action: string
    version: string
    date: Date
    host: string
    secret_key: string
    secret_id: string
    payload_hash: string
    canonical_querystring?: string
    canonical_headers: string
    signed_headers: string
    credential_scope: string
    key_prefix?: string
    signing_key_steps: string[]
    timestamp: string
    date_stamp: string
}

export async function build_authorization_header(opts: BuildAuthorizationHeaderOpts): Promise<{
    authorization: string
    timestamp: string
    date_stamp: string
}> {
    const {
        algorithm,
        secret_key,
        secret_id,
        payload_hash,
        canonical_querystring = '',
        canonical_headers,
        signed_headers,
        credential_scope,
        key_prefix = '',
        signing_key_steps,
        timestamp,
        date_stamp,
    } = opts

    const canonical_request = `POST\n/\n${canonical_querystring}\n${canonical_headers}\n${signed_headers}\n${payload_hash}`

    const string_to_sign = `${algorithm}\n${timestamp}\n${credential_scope}\n${await sha256(canonical_request)}`

    let signing_key: ArrayBuffer = new TextEncoder().encode(`${key_prefix}${secret_key}`).buffer
    for (const step of signing_key_steps) {
        const hex = await hmac(signing_key, step, 'SHA-256')
        signing_key = hexToBytes(hex).buffer as ArrayBuffer
    }
    const signature = await hmac(signing_key, string_to_sign, 'SHA-256')

    const authorization = `${algorithm} Credential=${secret_id}/${credential_scope}, SignedHeaders=${signed_headers}, Signature=${signature}`

    return { authorization, timestamp, date_stamp }
}
