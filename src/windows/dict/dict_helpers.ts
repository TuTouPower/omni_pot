import type { DictResult, ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import { log_error as unified_log_error } from '../../utils/error_handler'

export function log_error(action: string, err: unknown): void {
    unified_log_error('dict', action, err)
}

export function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

export function dict_result_to_text(result: DictResult): string {
    return result.definitions
        .map((d) => `${d.part_of_speech} ${d.meanings.join('; ')}`)
        .join('\n')
}
