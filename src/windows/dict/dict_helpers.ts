import type { DictResult, ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import { create_logger } from '../../utils/logger'

const log = create_logger('dict')

export function log_error(action: string, err: unknown): void {
    log.error('%s failed: %s', action, err instanceof Error ? err.message : String(err))
}

export function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

export function dict_result_to_text(result: DictResult): string {
    return result.definitions
        .map((d) => `${d.partOfSpeech} ${d.meanings.join('; ')}`)
        .join('\n')
}
