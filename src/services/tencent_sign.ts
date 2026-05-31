import { hmac, sha256, hexToBytes } from '@/lib/crypto'

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
    const date = `${String(cst.getFullYear())}-${String(cst.getMonth() + 1).padStart(2, '0')}-${String(cst.getDate()).padStart(2, '0')}`

    const contentType = 'application/json; charset=utf-8'
    const hashedPayload = await sha256(body)

    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
    const signedHeaders = 'content-type;host;x-tc-action'
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`

    const credentialScope = `${date}/${service}/tc3_request`
    const stringToSign = `TC3-HMAC-SHA256\n${String(timestamp)}\n${credentialScope}\n${await sha256(canonicalRequest)}`

    const kDate = await hmac(`TC3${secretKey}`, date, 'SHA-256')
    const kService = await hmac(hexToBytes(kDate).buffer as ArrayBuffer, service, 'SHA-256')
    const kSigning = await hmac(hexToBytes(kService).buffer as ArrayBuffer, 'tc3_request', 'SHA-256')
    const signature = await hmac(hexToBytes(kSigning).buffer as ArrayBuffer, stringToSign, 'SHA-256')

    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

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
