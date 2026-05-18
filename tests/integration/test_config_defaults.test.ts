import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG, DEFAULT_SERVICE_INSTANCES } from '@shared/types/config'
import type { AppConfig } from '@shared/types/config'

describe('Config defaults', () => {
    it('has all required keys', () => {
        const required_keys: (keyof AppConfig)[] = [
            'app_language', 'app_theme', 'app_primary_color', 'server_port',
            'translate_source_language', 'translate_target_language',
            'hotkey_translate',
            'translate_service_list', 'dictionary_service_list', 'recognize_service_list', 'tts_service_list',
            'collection_service_list', 'service_instances',
            'backup_type', 'webdav_url'
        ]
        for (const key of required_keys) {
            expect(key in DEFAULT_CONFIG).toBe(true)
        }
    })

    it('defaults to bing/deepl/mymemory services', () => {
        expect(DEFAULT_CONFIG.translate_service_list).toEqual([
            'bing@default', 'deepl@default', 'mymemory@default'
        ])
    })

    it('default service instances have correct keys', () => {
        expect(DEFAULT_SERVICE_INSTANCES['bing@default'].serviceKey).toBe('bing')
        expect(DEFAULT_SERVICE_INSTANCES['deepl@default'].serviceKey).toBe('deepl')
        expect(DEFAULT_SERVICE_INSTANCES['mymemory@default'].serviceKey).toBe('mymemory')
    })

    it('server_port is a number in valid range', () => {
        expect(typeof DEFAULT_CONFIG.server_port).toBe('number')
        expect(DEFAULT_CONFIG.server_port).toBeGreaterThanOrEqual(0)
        expect(DEFAULT_CONFIG.server_port).toBeLessThanOrEqual(65535)
    })
})
