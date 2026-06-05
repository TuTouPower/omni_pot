import http from 'http'

export const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_OCR_BODY_SIZE = 50 * 1024 * 1024 // 50 MB

export class BodyTooLargeError extends Error {
    constructor() {
        super('Body too large')
        this.name = 'BodyTooLargeError'
    }
}

export function readBody(req: http.IncomingMessage, maxBytes: number = MAX_BODY_SIZE): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        let total = 0
        req.on('data', (chunk: Buffer) => {
            total += chunk.length
            if (total > maxBytes) {
                req.destroy()
                reject(new BodyTooLargeError())
                return
            }
            chunks.push(chunk)
        })
        req.on('end', () => { resolve(Buffer.concat(chunks)); })
        req.on('error', reject)
    })
}

export function respondBodyTooLarge(res: http.ServerResponse): void {
    res.writeHead(413)
    res.end(JSON.stringify({ success: false, error: 'body too large' }))
}

export function parse_json_body(buf: Buffer): Record<string, unknown> {
    const body = buf.toString('utf-8').trim()
    if (!body) return {}
    const parsed = JSON.parse(body) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
}
