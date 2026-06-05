import { create_logger } from '../../utils/logger'
import type { ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'

const log = create_logger('translate')

export function log_error(action: string, err: unknown): void {
    log.error('%s failed: %s', action, err instanceof Error ? err.message : String(err))
}

export function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}

export function normalize_source_text(text: string): string {
    return text.replace(/-\s+/g, '').replace(/\s+/g, ' ')
}
