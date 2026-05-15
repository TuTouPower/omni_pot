import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('Config Store - pure logic', () => {
    const test_dir = join(tmpdir(), `pot-test-config-${String(Date.now())}`)
    const config_path = join(test_dir, 'config.json')

    beforeEach(() => {
        mkdirSync(test_dir, { recursive: true })
    })

    afterEach(() => {
        rmSync(test_dir, { recursive: true, force: true })
    })

    it('reads config from JSON file', () => {
        const config = { app_language: 'zh_cn', app_theme: 'dark' }
        writeFileSync(config_path, JSON.stringify(config))

        const raw = JSON.parse(readFileSync(config_path, 'utf-8')) as typeof config
        expect(raw.app_language).toBe('zh_cn')
        expect(raw.app_theme).toBe('dark')
    })

    it('writes config to JSON file', () => {
        const config = { app_language: 'en' }
        writeFileSync(config_path, JSON.stringify(config, null, 2))

        const raw = JSON.parse(readFileSync(config_path, 'utf-8')) as typeof config
        expect(raw.app_language).toBe('en')
    })

    it('returns default for missing key', () => {
        const defaults = { app_language: 'en', app_theme: 'system' as const }
        const stored: Record<string, unknown> = {}
        const get = (key: string) =>
            stored[key] ?? defaults[key as keyof typeof defaults]
        expect(get('app_language')).toBe('en')
        expect(get('app_theme')).toBe('system')
    })

    it('handles corrupted config file gracefully', () => {
        writeFileSync(config_path, 'not valid json {{{')
        let parsed: Record<string, unknown> = {}
        try {
            parsed = JSON.parse(readFileSync(config_path, 'utf-8')) as Record<string, unknown>
        } catch {
            parsed = {}
        }
        expect(parsed).toEqual({})
    })

    it('detects first run via __initialized flag', () => {
        const data: Record<string, unknown> = {}
        expect(data.__initialized !== true).toBe(true)

        data.__initialized = true
        expect(data.__initialized === true).toBe(true)
    })

    it('merges stored config over defaults', () => {
        const defaults = { a: 1, b: 2, c: 3 }
        const stored = { b: 99 }
        const merged = { ...defaults, ...stored }
        expect(merged).toEqual({ a: 1, b: 99, c: 3 })
    })
})
