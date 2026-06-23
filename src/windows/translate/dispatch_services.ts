import { translateServiceRegistry } from '../../services/registry'
import { getServiceKey } from '@shared/types/service'
import { useTranslateStore } from '../../stores/translate_store'
import { create_logger } from '../../utils/logger'
import { get_service_config } from './translate_helpers'
import type { DictResult } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import type { LanguageCode } from '@shared/types/language'

const log = create_logger('dispatch')

export interface DispatchResult {
    resultsMap: Record<string, string | DictResult | null>
}

export async function dispatch_services(
    text: string,
    effectiveSource: LanguageCode,
    effectiveTarget: LanguageCode,
    _sourceLanguage: LanguageCode,
    enabledServiceList: string[],
    serviceInstances: unknown,
    requestId: number,
    setResult: (key: string, value: string | DictResult | null) => void,
): Promise<DispatchResult> {
    const resultsMap: Record<string, string | DictResult | null> = {}
    const svcInstances = serviceInstances as ServiceInstancesMap

    const promises = enabledServiceList.map(async (instanceKey) => {
        const serviceKey = getServiceKey(instanceKey)
        const service = translateServiceRegistry.get(serviceKey)
        if (!service) {
            log.warn('[service:%s] not found in registry (serviceKey=%s)', instanceKey, serviceKey)
            resultsMap[instanceKey] = null
            if (useTranslateStore.getState().requestId === requestId) {
                setResult(instanceKey, null)
            }
            return
        }
        const instanceConfig = get_service_config(svcInstances, instanceKey)
        log.debug('[service:%s] CALL service=%s from=%s to=%s text=%j',
            instanceKey, serviceKey, effectiveSource, effectiveTarget, text.slice(0, 30))

        try {
            if (service.translateStream) {
                let accumulated = ''
                let lastUpdateTime = 0
                for await (const chunk of service.translateStream(text, effectiveSource, effectiveTarget, instanceConfig)) {
                    accumulated += chunk
                    const now = Date.now()
                    if (now - lastUpdateTime > 50 && useTranslateStore.getState().requestId === requestId) {
                        setResult(instanceKey, accumulated)
                        lastUpdateTime = now
                    }
                }
                if (useTranslateStore.getState().requestId === requestId) {
                    setResult(instanceKey, accumulated)
                }
                resultsMap[instanceKey] = accumulated
                log.debug('[service:%s] RESULT stream len=%d', instanceKey, accumulated.length)
            } else {
                const result = await service.translate(text, effectiveSource, effectiveTarget, instanceConfig)
                resultsMap[instanceKey] = result
                if (useTranslateStore.getState().requestId === requestId) {
                    setResult(instanceKey, result)
                }
                log.debug('[service:%s] RESULT type=%s', instanceKey, typeof result)
            }
        } catch (err) {
            log.error('[service:%s] FAILED: %s', instanceKey, err instanceof Error ? err.stack ?? err.message : String(err))
            resultsMap[instanceKey] = null
            if (useTranslateStore.getState().requestId === requestId) {
                setResult(instanceKey, null)
            }
        }
    })

    await Promise.allSettled(promises)
    return { resultsMap }
}
