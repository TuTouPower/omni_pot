import { ttsServiceRegistry } from '../tts_registry'
import { systemTtsService } from './system_tts'

export function registerAllTtsServices(): void {
    ttsServiceRegistry.register(systemTtsService)
}

export { ttsServiceRegistry } from '../tts_registry'
