import { log_error as unified_log_error } from '../../utils/error_handler'
import { get_service_config as shared_get_service_config } from '@shared/service_helpers'

export { try_qr_decode } from '../qr_decode'

export const QRCODE_INSTANCE_KEY = 'qrcode@default'

export function log_error(action: string, err: unknown): void {
    unified_log_error('recognize', action, err)
}

export { shared_get_service_config as get_service_config }
