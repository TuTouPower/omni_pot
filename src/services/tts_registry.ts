import type { TtsService } from '@shared/types/tts_service'
import { ServiceRegistry } from './registry'

export const ttsServiceRegistry = new ServiceRegistry<TtsService>()
