import { ocrServiceRegistry } from '../registry'
import { tesseractOcrService } from './tesseract'
import { baiduOcrService } from './baidu_ocr'
import { tencentOcrService } from './tencent_ocr'
import { volcengineOcrService } from './volcengine_ocr'
import { openaiVisionOcrService } from './openai_vision'
import { qrcodeOcrService } from './qrcode'

export function registerAllOcrServices(): void {
    ocrServiceRegistry.register(tesseractOcrService)
    ocrServiceRegistry.register(baiduOcrService)
    ocrServiceRegistry.register(tencentOcrService)
    ocrServiceRegistry.register(volcengineOcrService)
    ocrServiceRegistry.register(openaiVisionOcrService)
    ocrServiceRegistry.register(qrcodeOcrService)
}
