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

    it('app settings have correct defaults', () => {
        expect(DEFAULT_CONFIG.app_language).toBe('en')
        expect(DEFAULT_CONFIG.app_theme).toBe('system')
        expect(DEFAULT_CONFIG.app_primary_color).toBe('#5a9bbf')
        expect(DEFAULT_CONFIG.app_font).toBe('default')
        expect(DEFAULT_CONFIG.app_fallback_font).toBe('default')
        expect(DEFAULT_CONFIG.app_font_size).toBe(16)
        expect(DEFAULT_CONFIG.transparent).toBe(false)
        expect(DEFAULT_CONFIG.check_update).toBe(true)
        expect(DEFAULT_CONFIG.server_port).toBe(20202)
        expect(DEFAULT_CONFIG.clipboard_monitor).toBe(false)
        expect(DEFAULT_CONFIG.auto_start).toBe(false)
        expect(DEFAULT_CONFIG.tray_click_event).toBe('show_config')
        expect(DEFAULT_CONFIG.dict_chinese_enabled).toBe(true)
    })

    it('translate settings have correct defaults', () => {
        expect(DEFAULT_CONFIG.translate_source_language).toBe('auto')
        expect(DEFAULT_CONFIG.translate_target_language).toBe('zh_cn')
        expect(DEFAULT_CONFIG.translate_second_language).toBe('en')
        expect(DEFAULT_CONFIG.translate_auto_copy).toBe(false)
        expect(DEFAULT_CONFIG.incremental_translate).toBe(false)
        expect(DEFAULT_CONFIG.history_disable).toBe(false)
        expect(DEFAULT_CONFIG.dynamic_translate).toBe(false)
        expect(DEFAULT_CONFIG.translate_delete_newline).toBe(false)
        expect(DEFAULT_CONFIG.translate_window_position).toBe('mouse')
        expect(DEFAULT_CONFIG.translate_remember_window_size).toBe(true)
        expect(DEFAULT_CONFIG.translate_pinned).toBe(false)
        expect(DEFAULT_CONFIG.translate_always_on_top).toBe(false)
        expect(DEFAULT_CONFIG.hide_source).toBe(false)
        expect(DEFAULT_CONFIG.hide_language).toBe(false)
        expect(DEFAULT_CONFIG.translate_hide_window).toBe(false)
    })

    it('window size defaults', () => {
        expect(DEFAULT_CONFIG.translate_window_width).toBe(350)
        expect(DEFAULT_CONFIG.translate_window_height).toBe(420)
    })

    it('recognize settings have correct defaults', () => {
        expect(DEFAULT_CONFIG.recognize_language).toBe('auto')
        expect(DEFAULT_CONFIG.recognize_engine).toBe('tesseract@default')
        expect(DEFAULT_CONFIG.recognize_delete_newline).toBe(false)
        expect(DEFAULT_CONFIG.recognize_auto_copy).toBe(true)
        expect(DEFAULT_CONFIG.recognize_always_on_top).toBe(false)
        expect(DEFAULT_CONFIG.recognize_pinned).toBe(false)
        expect(DEFAULT_CONFIG.dict_always_on_top).toBe(false)
        expect(DEFAULT_CONFIG.dict_pinned).toBe(false)
    })

    it('hotkeys default to empty', () => {
        expect(DEFAULT_CONFIG.hotkey_translate).toBe('')
        expect(DEFAULT_CONFIG.hotkey_ocr_recognize).toBe('')
        expect(DEFAULT_CONFIG.hotkey_ocr_translate).toBe('')
        expect(DEFAULT_CONFIG.hotkey_selection_dictionary).toBe('')
    })

    it('service lists have correct defaults', () => {
        expect(DEFAULT_CONFIG.translate_service_list).toEqual([
            'bing@default', 'deepl@default', 'mymemory@default'
        ])
        expect(DEFAULT_CONFIG.dictionary_service_list).toEqual([
            'chinese_dictionary@default', 'ecdict@default'
        ])
        expect(DEFAULT_CONFIG.english_dictionary_service_list).toEqual([
            'cambridge_dict@default', 'ecdict@default'
        ])
        expect(DEFAULT_CONFIG.recognize_service_list).toEqual(['tesseract@default', 'system@default', 'qrcode@default'])
        expect(DEFAULT_CONFIG.tts_service_list).toEqual(['system_tts@default'])
        expect(DEFAULT_CONFIG.collection_service_list).toEqual([])
    })

    it('backup defaults', () => {
        expect(DEFAULT_CONFIG.backup_type).toBe('webdav')
        expect(DEFAULT_CONFIG.webdav_url).toBe('')
    })

    it('default service instances have correct keys', () => {
        expect(DEFAULT_SERVICE_INSTANCES['bing@default'].serviceKey).toBe('bing')
        expect(DEFAULT_SERVICE_INSTANCES['deepl@default'].serviceKey).toBe('deepl')
        expect(DEFAULT_SERVICE_INSTANCES['mymemory@default'].serviceKey).toBe('mymemory')
    })
})
