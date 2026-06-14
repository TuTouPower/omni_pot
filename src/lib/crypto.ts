import SparkMD5 from 'spark-md5'

function md5(input: string): string {
    return SparkMD5.hash(input)
}

async function hmac(key: string | ArrayBuffer, message: string, algorithm: string): Promise<string> {
    const encoder = new TextEncoder()
    const keyData = typeof key === 'string' ? encoder.encode(key) : key
    const msgData = encoder.encode(message)
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: algorithm }, false, ['sign'])
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(message: string): Promise<string> {
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(message))
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return bytes
}

function hexToBase64(hex: string): string {
    const bytes = hexToBytes(hex)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i] ?? 0)
    }
    return btoa(binary)
}

export { md5, hmac, sha256, hexToBytes, hexToBase64 }
