import type { ServiceConfig } from '@shared/types/service'
import type { ServiceInstancesMap } from '@shared/types/config'
import { log_error as unified_log_error } from '../../utils/error_handler'

export { try_qr_decode } from '../qr_decode'

export const QRCODE_INSTANCE_KEY = 'qrcode@default'

export function log_error(action: string, err: unknown): void {
    unified_log_error('recognize', action, err)
}

export function get_service_config(service_instances: ServiceInstancesMap, instance_key: string): ServiceConfig {
    return (service_instances as Partial<ServiceInstancesMap>)[instance_key]?.config ?? {}
}
