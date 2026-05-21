export function build_csp_policy(is_packaged: boolean): string {
    if (is_packaged) {
        return "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' http://localhost:* http://127.0.0.1:* https:"
    }

    return "default-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* http://127.0.0.1:*; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http://localhost:* http://127.0.0.1:*; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https:"
}
