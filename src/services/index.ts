import { translateServiceRegistry, ServiceRegistry } from './registry'
import { bingService } from './bing'
import { googleService } from './google'
import { deeplService } from './deepl'
import { lingvaService } from './lingva'
import { cambridgeDictService } from './cambridge_dict'
import { alibabaService } from './alibaba'
import { baiduService } from './baidu'
import { baiduFieldService } from './baidu_field'
import { caiyunService } from './caiyun'
import { niutransService } from './niutrans'
import { youdaoService } from './youdao'
import { volcengineService } from './volcengine'
import { transmartService } from './transmart'
import { tencentService } from './tencent'
import { openaiService } from './openai'
import { chatglmService } from './chatglm'
import { geminiproService } from './geminipro'
import { ollamaService } from './ollama'
import { registerAllTtsServices } from './tts'
import { registerAllOcrServices } from './ocr'
import { collectionServices } from './collection'
import type { CollectionService } from '@shared/types/collection_service'

export const collectionServiceRegistry = new ServiceRegistry<CollectionService>()

export function registerAllServices(): void {
    translateServiceRegistry.register(bingService)
    translateServiceRegistry.register(googleService)
    translateServiceRegistry.register(deeplService)
    translateServiceRegistry.register(lingvaService)
    translateServiceRegistry.register(cambridgeDictService)
    translateServiceRegistry.register(alibabaService)
    translateServiceRegistry.register(baiduService)
    translateServiceRegistry.register(baiduFieldService)
    translateServiceRegistry.register(caiyunService)
    translateServiceRegistry.register(niutransService)
    translateServiceRegistry.register(youdaoService)
    translateServiceRegistry.register(volcengineService)
    translateServiceRegistry.register(transmartService)
    translateServiceRegistry.register(tencentService)
    translateServiceRegistry.register(openaiService)
    translateServiceRegistry.register(chatglmService)
    translateServiceRegistry.register(geminiproService)
    translateServiceRegistry.register(ollamaService)

    registerAllTtsServices()
    registerAllOcrServices()

    for (const svc of collectionServices) {
        collectionServiceRegistry.register(svc)
    }
}

export { translateServiceRegistry, ocrServiceRegistry } from './registry'
