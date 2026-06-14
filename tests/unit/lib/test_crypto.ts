import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { md5, sha256, hmac } from '../../../src/lib/crypto'

describe('crypto', () => {
    describe('md5', () => {
        it('computes md5 hash of empty string', () => {
            expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
        })

        it('computes md5 hash of "hello"', () => {
            expect(md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592')
        })

        it('computes md5 hash of unicode text', () => {
            const hash = md5('你好')
            expect(hash).toMatch(/^[0-9a-f]{32}$/)
            expect(hash).not.toBe(md5(''))
        })

        it('output matches node:crypto createHash', () => {
            for (const input of ['', 'hello', '你好', 'a'.repeat(1000)]) {
                const expected = createHash('md5').update(input).digest('hex')
                expect(md5(input)).toBe(expected)
            }
        })
    })

    describe('sha256', () => {
        it('computes sha256 hash', async () => {
            const hash = await sha256('hello')
            expect(hash).toBe(
                '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
            )
        })
    })

    describe('hmac', () => {
        it('computes hmac-sha256', async () => {
            const result = await hmac('key', 'message', 'SHA-256')
            expect(result).toHaveLength(64)
            expect(result).toMatch(/^[0-9a-f]+$/)
        })
    })
})
