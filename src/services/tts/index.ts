import { ttsServiceRegistry } from '../tts_registry'
import { edgeTtsService } from './edge_tts'
import { lingvaTtsService } from './lingva_tts'
import { systemTtsService } from './system_tts'

export function registerAllTtsServices(): void {
    ttsServiceRegistry.register(systemTtsService)
    ttsServiceRegistry.register(edgeTtsService)
    ttsServiceRegistry.register(lingvaTtsService)
}

export { ttsServiceRegistry } from '../tts_registry'
