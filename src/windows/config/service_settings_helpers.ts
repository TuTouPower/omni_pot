import { translateServiceRegistry, dictionaryServiceRegistry, ocrServiceRegistry } from '../../services/registry'
import { ttsServiceRegistry } from '../../services/tts_registry'
import type { ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'

export type ServiceCategory = 'translate_service_list' | 'dictionary_service_list' | 'english_dictionary_service_list' | 'recognize_service_list' | 'tts_service_list'
type TestableService = { testConfig(config: Record<string, unknown>): Promise<boolean> }

export const CATEGORY_TABS = [
    { key: 'translate_service_list' as ServiceCategory, labelKey: 'service.translate', label: '翻译' },
    { key: 'dictionary_service_list' as ServiceCategory, labelKey: 'service.chinese_dictionary', label: 'Chinese Dictionary' },
    { key: 'english_dictionary_service_list' as ServiceCategory, labelKey: 'service.english_dictionary', label: '英文词典' },
    { key: 'recognize_service_list' as ServiceCategory, labelKey: 'service.ocr', label: '文字识别' },
    { key: 'tts_service_list' as ServiceCategory, labelKey: 'service.tts', label: '语音朗读' },
]

export function getRegistryForCategory(category: ServiceCategory) {
    switch (category) {
        case 'translate_service_list': return translateServiceRegistry
        case 'dictionary_service_list': return dictionaryServiceRegistry
        case 'english_dictionary_service_list': return dictionaryServiceRegistry
        case 'recognize_service_list': return ocrServiceRegistry
        case 'tts_service_list': return ttsServiceRegistry
    }
}

export function service_has_test_config(service: unknown): service is TestableService {
    return !!service && typeof (service as { testConfig?: unknown }).testConfig === 'function'
}

export function visible_config_text(config: ServiceConfig): string {
    const values = { ...config }
    delete values.enable
    delete values.instance_name
    return JSON.stringify(values, null, 4)
}

export function parse_config_text(text: string): ServiceConfig | null {
    const trimmed = text.trim()
    if (!trimmed) return {}
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const result: ServiceConfig = {}
    for (const [key, value] of Object.entries(parsed)) {
        if (value === undefined || ['string', 'number', 'boolean'].includes(typeof value)) {
            result[key] = value as string | number | boolean | undefined
        } else {
            return null
        }
    }
    return result
}

export function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}
