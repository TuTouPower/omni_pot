import { sha256 } from '@/lib/crypto'
import { build_authorization_header } from './aws_sig_v4'

interface TencentSignOpts {
    secretId: string
    secretKey: string
    host: string
    service: string
    region: string
    action: string
    version: string
    body: string
}

export async function signTencentRequest(opts: TencentSignOpts): Promise<{
    headers: Record<string, string>
}> {
    const { secretId, secretKey, host, service, region, action, version, body } = opts

    const timestamp = Math.floor(Date.now() / 1000)
    const cst = new Date(timestamp * 1000 + 8 * 3600000)
    const date_stamp = `${String(cst.getFullYear())}-${String(cst.getMonth() + 1).padStart(2, '0')}-${String(cst.getDate()).padStart(2, '0')}`

    const contentType = 'application/json; charset=utf-8'
    const hashedPayload = await sha256(body)

    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
    const signedHeaders = 'content-type;host;x-tc-action'
    const credentialScope = `${date_stamp}/${service}/tc3_request`

    const { authorization } = await build_authorization_header({
        algorithm: 'TC3-HMAC-SHA256',
        service,
        region,
        action,
        version,
        date: cst,
        host,
        secret_key: secretKey,
        secret_id: secretId,
        payload_hash: hashedPayload,
        canonical_headers: canonicalHeaders,
        signed_headers: signedHeaders,
        credential_scope: credentialScope,
        key_prefix: 'TC3',
        signing_key_steps: [date_stamp, service, 'tc3_request'],
        timestamp: String(timestamp),
        date_stamp,
    })

    return {
        headers: {
            'Content-Type': contentType,
            'Host': host,
            'X-TC-Action': action,
            'X-TC-Timestamp': String(timestamp),
            'X-TC-Version': version,
            'X-TC-Region': region,
            'Authorization': authorization
        }
    }
}
