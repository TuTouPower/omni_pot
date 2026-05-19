import type { ServiceConfig } from './service'

export const APP_PRIMARY_COLORS = ['#c4623a', '#3a6ea5', '#5c8a4f', '#b8902f', '#5a9bbf'] as const
export type AppPrimaryColor = typeof APP_PRIMARY_COLORS[number]

export interface AppConfig {
  app_language: string
  app_theme: 'system' | 'light' | 'dark'
  app_primary_color: AppPrimaryColor
  app_font: string
  app_fallback_font: string
  app_font_size: number
  transparent: boolean
  check_update: boolean
  server_port: number
  clipboard_monitor: boolean

  translate_source_language: string
  translate_target_language: string
  translate_second_language: string
  translate_detect_engine: string
  translate_auto_copy: 'disable' | 'source' | 'target' | 'source_target'
  incremental_translate: boolean
  history_disable: boolean
  dynamic_translate: boolean
  translate_delete_newline: boolean
  translate_remember_language: boolean

  translate_window_position: 'mouse' | 'pre_state'
  translate_remember_window_size: boolean
  translate_pinned: boolean
  translate_always_on_top: boolean
  hide_source: boolean
  hide_language: boolean
  translate_hide_window: boolean

  translate_window_width: number
  translate_window_height: number
  translate_window_position_x: number
  translate_window_position_y: number

  dict_always_on_top: boolean
  recognize_always_on_top: boolean

  recognize_language: string
  recognize_delete_newline: boolean
  recognize_auto_copy: boolean
  recognize_hide_window: boolean

  hotkey_translate: string
  hotkey_selection_translate: string
  hotkey_input_translate: string
  hotkey_ocr_recognize: string
  hotkey_ocr_translate: string
  hotkey_selection_dictionary: string

  translate_service_list: string[]
  dictionary_service_list: string[]
  english_dictionary_service_list: string[]
  recognize_service_list: string[]
  tts_service_list: string[]
  collection_service_list: string[]

  service_instances: ServiceInstancesMap

  backup_type: string
  webdav_url: string
  webdav_username: string
  webdav_password: string

  auto_start: boolean
  tray_click_event: 'show_config' | 'show_translate' | 'none'

  dict_chinese_enabled: boolean
  detect_cld3_enabled: boolean
}

// service_instances: instance key -> instance config; main process builds default instances on first launch
export interface ServiceInstancesMap {
  [instanceKey: string]: { serviceKey: string; config: ServiceConfig }
}

export const DEFAULT_SERVICE_INSTANCES: ServiceInstancesMap = {
  'bing@default': { serviceKey: 'bing', config: {} },
  'google@default': { serviceKey: 'google', config: {} },
  'deepl@default': { serviceKey: 'deepl', config: {} },
  'tesseract@default': { serviceKey: 'tesseract', config: {} },
  'mymemory@default': { serviceKey: 'mymemory', config: {} },
  'free_dictionary@default': { serviceKey: 'free_dictionary', config: {} },
  'ecdict@default': { serviceKey: 'ecdict', config: {} },
  'chinese_dictionary@default': { serviceKey: 'chinese_dictionary', config: {} },
  'cambridge_dict@default': { serviceKey: 'cambridge_dict', config: {} },
  'system_tts@default': { serviceKey: 'system_tts', config: {} }
}
export const DEFAULT_CONFIG: AppConfig = {
  app_language: 'en',
  app_theme: 'system',
  app_primary_color: '#5a9bbf',
  app_font: 'default',
  app_fallback_font: 'default',
  app_font_size: 16,
  transparent: true,
  check_update: true,
  server_port: 20202,
  clipboard_monitor: false,

  translate_source_language: 'auto',
  translate_target_language: 'zh_cn',
  translate_second_language: 'en',
  translate_detect_engine: 'bing',
  translate_auto_copy: 'disable',
  incremental_translate: false,
  history_disable: false,
  dynamic_translate: false,
  translate_delete_newline: false,
  translate_remember_language: false,

  translate_window_position: 'mouse',
  translate_remember_window_size: false,
  translate_pinned: false,
  translate_always_on_top: false,
  hide_source: false,
  hide_language: false,
  translate_hide_window: false,

  recognize_language: 'auto',
  recognize_delete_newline: true,
  recognize_auto_copy: true,
  recognize_hide_window: true,

  translate_window_width: 350,
  translate_window_height: 420,
  translate_window_position_x: 0,
  translate_window_position_y: 0,

  dict_always_on_top: false,
  recognize_always_on_top: false,

  hotkey_translate: '',
  hotkey_selection_translate: '',
  hotkey_input_translate: '',
  hotkey_ocr_recognize: '',
  hotkey_ocr_translate: '',
  hotkey_selection_dictionary: '',

  translate_service_list: ['bing@default', 'deepl@default', 'mymemory@default'],
  dictionary_service_list: ['chinese_dictionary@default', 'ecdict@default'],
  english_dictionary_service_list: ['cambridge_dict@default', 'ecdict@default'],
  recognize_service_list: ['tesseract@default'],
  tts_service_list: ['system_tts@default'],
  collection_service_list: [],

  service_instances: DEFAULT_SERVICE_INSTANCES,

  backup_type: 'webdav',
  webdav_url: '',
  webdav_username: '',
  webdav_password: '',

  auto_start: false,
  tray_click_event: 'show_config',

  dict_chinese_enabled: true,
  detect_cld3_enabled: true
}

export type ConfigKey = keyof AppConfig
