import { translateServiceRegistry } from './registry'
import { bingService } from './bing'
import { googleService } from './google'
import { deeplService } from './deepl'
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
import { mymemoryService } from './mymemory'
import { freeDictionaryService } from './free_dictionary'
import { chineseDictionaryService } from './chinese_dictionary'
import { registerAllTtsServices } from './tts'
import { registerAllOcrServices } from './ocr'

export function registerAllServices(): void {
    translateServiceRegistry.register(bingService)
    translateServiceRegistry.register(googleService)
    translateServiceRegistry.register(deeplService)
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
    translateServiceRegistry.register(mymemoryService)
    translateServiceRegistry.register(freeDictionaryService)
    translateServiceRegistry.register(chineseDictionaryService)

    registerAllTtsServices()
    registerAllOcrServices()
}

export { translateServiceRegistry, ocrServiceRegistry } from './registry'
