import { ttsServiceRegistry } from '../tts_registry'
import { edgeTtsService } from './edge_tts'
import { lingvaTtsService } from './lingva_tts'

export function registerAllTtsServices(): void {
    ttsServiceRegistry.register(edgeTtsService)
    ttsServiceRegistry.register(lingvaTtsService)
}

export { ttsServiceRegistry } from '../tts_registry'
