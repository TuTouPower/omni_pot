import type { AppConfig } from '@shared/types/config'

export type PublicConfig = Partial<Omit<AppConfig, 'service_instances' | 'server_api_token'>> & {
    service_instances: Record<string, { serviceKey: string; config: Record<string, unknown> }>
}

const PUBLIC_SERVICE_CONFIG_KEYS = new Set(['enable', 'instance_name'])
const PUBLIC_CONFIG_KEYS: Array<keyof Omit<AppConfig, 'service_instances' | 'server_api_token'>> = [
    'app_language',
    'app_theme',
    'app_primary_color',
    'app_font',
    'app_fallback_font',
    'app_font_size',
    'transparent',
    'check_update',
    'server_port',
    'clipboard_monitor',
    'translate_source_language',
    'translate_target_language',
    'translate_second_language',
    'translate_auto_copy',
    'incremental_translate',
    'history_disable',
    'dynamic_translate',
    'translate_delete_newline',
    'translate_window_position',
    'translate_remember_window_size',
    'translate_pinned',
    'translate_always_on_top',
    'hide_source',
    'hide_language',
    'translate_hide_window',
    'welcome_dismissed',
    'translate_window_width',
    'translate_window_height',
    'translate_window_position_x',
    'translate_window_position_y',
    'dict_always_on_top',
    'dict_pinned',
    'dict_remember_window_size',
    'dict_window_width',
    'dict_window_height',
    'recognize_always_on_top',
    'recognize_pinned',
    'recognize_remember_window_size',
    'recognize_window_width',
    'recognize_window_height',
    'recognize_language',
    'recognize_engine',
    'recognize_delete_newline',
    'recognize_auto_copy',
    'hotkey_translate',
    'hotkey_ocr_recognize',
    'hotkey_ocr_translate',
    'hotkey_selection_dictionary',
    'translate_service_list',
    'dictionary_service_list',
    'english_dictionary_service_list',
    'recognize_service_list',
    'tts_service_list',
    'backup_type',
    'auto_start',
    'tray_click_event',
    'dict_chinese_enabled',
]

function redact_service_config(config: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(config).filter(([key]) => PUBLIC_SERVICE_CONFIG_KEYS.has(key)))
}

export function get_public_config_from_config(config: AppConfig): PublicConfig {
    const public_config: PublicConfig = {
        service_instances: Object.fromEntries(Object.entries(config.service_instances).map(([instance_key, instance]) => [
            instance_key,
            {
                serviceKey: instance.serviceKey,
                config: redact_service_config(instance.config),
            },
        ])),
    }

    for (const key of PUBLIC_CONFIG_KEYS) {
        public_config[key] = config[key] as never
    }

    return public_config
}
