import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG, DEFAULT_SERVICE_INSTANCES } from '@shared/types/config'
import type { AppConfig } from '@shared/types/config'

describe('Config defaults', () => {
    it('has all required keys', () => {
        const required_keys: (keyof AppConfig)[] = [
            'app_language', 'app_theme', 'server_port',
            'proxy_enable', 'proxy_host', 'proxy_port',
            'translate_source_language', 'translate_target_language',
            'hotkey_selection_translate', 'hotkey_input_translate',
            'translate_service_list', 'dictionary_service_list', 'recognize_service_list', 'tts_service_list',
            'collection_service_list', 'service_instances',
            'backup_type', 'webdav_url'
        ]
        for (const key of required_keys) {
            expect(key in DEFAULT_CONFIG).toBe(true)
        }
    })

    it('defaults to bing/google/deepl services', () => {
        expect(DEFAULT_CONFIG.translate_service_list).toEqual([
            'bing@default', 'google@default', 'deepl@default'
        ])
    })

    it('default service instances have correct keys', () => {
        expect(DEFAULT_SERVICE_INSTANCES['bing@default'].serviceKey).toBe('bing')
        expect(DEFAULT_SERVICE_INSTANCES['google@default'].serviceKey).toBe('google')
        expect(DEFAULT_SERVICE_INSTANCES['deepl@default'].serviceKey).toBe('deepl')
    })

    it('server_port is a number in valid range', () => {
        expect(typeof DEFAULT_CONFIG.server_port).toBe('number')
        expect(DEFAULT_CONFIG.server_port).toBeGreaterThanOrEqual(0)
        expect(DEFAULT_CONFIG.server_port).toBeLessThanOrEqual(65535)
    })
})
