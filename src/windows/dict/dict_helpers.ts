import type { DictResult } from '@shared/types/service'
import { log_error as unified_log_error } from '../../utils/error_handler'
import { get_service_config as shared_get_service_config } from '@shared/service_helpers'

export function log_error(action: string, err: unknown): void {
    unified_log_error('dict', action, err)
}

export { shared_get_service_config as get_service_config }

export function dict_result_to_text(result: DictResult): string {
    return result.definitions
        .map((d) => `${d.part_of_speech} ${d.meanings.join('; ')}`)
        .join('\n')
}
