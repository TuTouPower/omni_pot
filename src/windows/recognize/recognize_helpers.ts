import type { ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import { create_logger } from '../../utils/logger'

export { try_qr_decode } from '../qr_decode'

const log = create_logger('recognize')

export const QRCODE_INSTANCE_KEY = 'qrcode@default'

export function log_error(action: string, err: unknown): void {
    log.error('%s failed: %s', action, err instanceof Error ? err.message : String(err))
}

export function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}
