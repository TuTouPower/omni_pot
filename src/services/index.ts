import { translateServiceRegistry } from './registry'
import { bingService } from './bing'
import { googleService } from './google'
import { deeplService } from './deepl'

export function registerAllServices(): void {
  translateServiceRegistry.register(bingService)
  translateServiceRegistry.register(googleService)
  translateServiceRegistry.register(deeplService)
}

export { translateServiceRegistry } from './registry'
