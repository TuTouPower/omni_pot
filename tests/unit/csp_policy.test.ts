import { describe, expect, it } from 'vitest'
import { build_csp_policy } from '../../src/main/csp_policy'

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

        // connect-src no longer includes https: wildcard — translation goes through main process proxy
        expect(csp.get('connect-src')).toContain("'self'")
        expect(csp.get('connect-src')).toContain('http://localhost:*')
        expect(csp.get('media-src')).toContain('blob:')
        expect(csp.get('media-src')).toContain('https:')
        expect(csp.get('worker-src')).toContain('blob:')
        expect(csp.get('script-src')).toContain(wasm_token)
    })

    it('does NOT allow connect-src https: wildcard in packaged builds', () => {
        const csp = parse_csp(build_csp_policy(true))
        expect(csp.get('connect-src')).not.toContain('https:')
    })
})
