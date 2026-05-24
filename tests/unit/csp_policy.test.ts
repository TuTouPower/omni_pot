import { describe, expect, it } from 'vitest'
import { build_csp_policy } from '../../electron/csp_policy'

function parse_csp(policy: string): Map<string, string[]> {
    return new Map(policy.split(';').map((directive) => {
        const [name, ...values] = directive.trim().split(/\s+/)
        return [name, values]
    }))
}

describe('CSP policy', () => {
    it.each([
        ['packaged', true, "'wasm-unsafe-eval'"],
        ['development', false, "'unsafe-eval'"],
    ])('allows required external service, media, worker, and WASM capabilities in %s builds', (_, is_packaged, wasm_token) => {
        const csp = parse_csp(build_csp_policy(is_packaged))

        expect(csp.get('connect-src')).toContain('https:')
        expect(csp.get('media-src')).toContain('blob:')
        expect(csp.get('media-src')).toContain('https:')
        expect(csp.get('worker-src')).toContain('blob:')
        expect(csp.get('script-src')).toContain(wasm_token)
    })
})
