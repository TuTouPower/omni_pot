export interface AppConfig {
  app_language: string
  app_theme: 'system' | 'light' | 'dark'
  app_font: string
  app_fallback_font: string
  app_font_size: number
  dev_mode: boolean
  transparent: boolean
  check_update: boolean
  server_port: number

  proxy_enable: boolean
  proxy_host: string
  proxy_port: string

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
  translate_close_on_blur: boolean
  translate_always_on_top: boolean
  hide_source: boolean
  hide_language: boolean
  translate_hide_window: boolean

  translate_window_width: number
  translate_window_height: number
  translate_window_position_x: number
  translate_window_position_y: number

  hotkey_selection_translate: string
  hotkey_input_translate: string
  hotkey_ocr_recognize: string
  hotkey_ocr_translate: string

  translate_service_list: string[]
  recognize_service_list: string[]
  tts_service_list: string[]
  collection_service_list: string[]

  service_instances: ServiceInstancesMap
}

// service_instances: instance key -> instance config; main process builds default instances on first launch
export interface ServiceInstancesMap {
  [instanceKey: string]: { serviceKey: string; config: Record<string, unknown> }
}

export const DEFAULT_SERVICE_INSTANCES: ServiceInstancesMap = {
  'bing@default': { serviceKey: 'bing', config: {} },
  'google@default': { serviceKey: 'google', config: {} },
  'deepl@default': { serviceKey: 'deepl', config: { type: 'free', authKey: '' } }
}

export const DEFAULT_CONFIG: AppConfig = {
  app_language: 'en',
  app_theme: 'system',
  app_font: 'default',
  app_fallback_font: 'default',
  app_font_size: 16,
  dev_mode: false,
  transparent: true,
  check_update: true,
  server_port: 60828,

  proxy_enable: false,
  proxy_host: '',
  proxy_port: '',

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
  translate_close_on_blur: true,
  translate_always_on_top: false,
  hide_source: false,
  hide_language: false,
  translate_hide_window: false,

  translate_window_width: 350,
  translate_window_height: 420,
  translate_window_position_x: 0,
  translate_window_position_y: 0,

  hotkey_selection_translate: '',
  hotkey_input_translate: '',
  hotkey_ocr_recognize: '',
  hotkey_ocr_translate: '',

  translate_service_list: ['bing@default', 'google@default', 'deepl@default'],
  recognize_service_list: [],
  tts_service_list: [],
  collection_service_list: [],

  service_instances: DEFAULT_SERVICE_INSTANCES
}

export type ConfigKey = keyof AppConfig
