import { hmac, sha256, hexToBytes } from '@/lib/crypto'

interface VolcengineSignOpts {
    appId: string
    secret: string
    host: string
    service: string
    region: string
    action: string
    version: string
    body: string
}

export async function signVolcengineRequest(opts: VolcengineSignOpts): Promise<{
    headers: Record<string, string>
    url: string
}> {
    const { appId, secret, host, service, region, action, version, body } = opts

    const timestamp = Math.floor(Date.now() / 1000)
    const d = new Date(timestamp * 1000)
    const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

    const hashedPayload = await sha256(body)
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-content-sha256:${hashedPayload}\nx-date:${date}\n`
    const signedHeaders = 'content-type;host;x-content-sha256;x-date'
    const canonicalRequest = `POST\n/\nAction=${action}&Version=${version}\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`

    const credentialScope = `${date}/${region}/${service}/request`
    const stringToSign = `HMAC-SHA256\n${date}\n${credentialScope}\n${await sha256(canonicalRequest)}`

    const kDate = await hmac(secret, date, 'SHA-256')
    const kRegion = await hmac(hexToBytes(kDate).buffer as ArrayBuffer, region, 'SHA-256')
    const kService = await hmac(hexToBytes(kRegion).buffer as ArrayBuffer, service, 'SHA-256')
    const kSigning = await hmac(hexToBytes(kService).buffer as ArrayBuffer, 'request', 'SHA-256')
    const signature = await hmac(hexToBytes(kSigning).buffer as ArrayBuffer, stringToSign, 'SHA-256')

    const authorization = `HMAC-SHA256 Credential=${appId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    return {
        headers: {
            'Content-Type': 'application/json',
            'Host': host,
            'X-Date': date,
            'X-Content-Sha256': hashedPayload,
            'Authorization': authorization
        },
        url: `https://${host}/?Action=${action}&Version=${version}`
    }
}
