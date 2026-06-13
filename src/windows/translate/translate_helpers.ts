import { log_error as unified_log_error } from '../../utils/error_handler'
import { get_service_config as shared_get_service_config } from '@shared/service_helpers'

export function log_error(action: string, err: unknown): void {
    unified_log_error('translate', action, err)
}

export { shared_get_service_config as get_service_config }

export function normalize_source_text(text: string): string {
    return text.replace(/-\s+/g, '').replace(/\s+/g, ' ')
}
