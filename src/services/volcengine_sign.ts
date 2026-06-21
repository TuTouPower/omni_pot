import { sha256 } from '@/lib/crypto'
import { build_authorization_header } from './aws_sig_v4'

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
    const d = new Date(timestamp * 1000 + 8 * 3600000)
    const x_date = d.toISOString().replace(/-/g, '').replace(/:/g, '').replace(/\.\d+/, '')
    const date_stamp = x_date.slice(0, 8)

    const hashedPayload = await sha256(body)
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-content-sha256:${hashedPayload}\nx-date:${x_date}\n`
    const signedHeaders = 'content-type;host;x-content-sha256;x-date'
    const credentialScope = `${date_stamp}/${region}/${service}/request`

    const { authorization } = await build_authorization_header({
        algorithm: 'HMAC-SHA256',
        service,
        region,
        action,
        version,
        date: d,
        host,
        secret_key: secret,
        secret_id: appId,
        payload_hash: hashedPayload,
        canonical_querystring: `Action=${action}&Version=${version}`,
        canonical_headers: canonicalHeaders,
        signed_headers: signedHeaders,
        credential_scope: credentialScope,
        signing_key_steps: [date_stamp, region, service, 'request'],
        timestamp: x_date,
        date_stamp,
    })

    return {
        headers: {
            'Content-Type': 'application/json',
            'Host': host,
            'X-Date': x_date,
            'X-Content-Sha256': hashedPayload,
            'Authorization': authorization
        },
        url: `https://${host}/?Action=${action}&Version=${version}`
    }
}
