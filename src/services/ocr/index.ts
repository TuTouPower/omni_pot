import { ocrServiceRegistry } from '../registry'
import { tesseractOcrService } from './tesseract'
import { baiduOcrService } from './baidu_ocr'
import { baiduAccurateOcrService } from './baidu_accurate_ocr'
import { baiduImgOcrService } from './baidu_img_ocr'
import { tencentOcrService } from './tencent_ocr'
import { tencentAccurateOcrService } from './tencent_accurate_ocr'
import { tencentImgOcrService } from './tencent_img_ocr'
import { volcengineOcrService } from './volcengine_ocr'
import { volcengineMultiLangOcrService } from './volcengine_multi_lang_ocr'
import { openaiVisionOcrService } from './openai_vision'
import { iflytekOcrService } from './iflytek_ocr'
import { iflytekIntsigOcrService } from './iflytek_intsig_ocr'
import { iflytekLatexOcrService } from './iflytek_latex_ocr'
import { simpleLatexOcrService } from './simple_latex_ocr'
import { qrcodeOcrService } from './qrcode'
import { systemOcrService } from './system'

export function registerAllOcrServices(): void {
    ocrServiceRegistry.register(tesseractOcrService)
    ocrServiceRegistry.register(baiduOcrService)
    ocrServiceRegistry.register(baiduAccurateOcrService)
    ocrServiceRegistry.register(baiduImgOcrService)
    ocrServiceRegistry.register(tencentOcrService)
    ocrServiceRegistry.register(tencentAccurateOcrService)
    ocrServiceRegistry.register(tencentImgOcrService)
    ocrServiceRegistry.register(volcengineOcrService)
    ocrServiceRegistry.register(volcengineMultiLangOcrService)
    ocrServiceRegistry.register(openaiVisionOcrService)
    ocrServiceRegistry.register(iflytekOcrService)
    ocrServiceRegistry.register(iflytekIntsigOcrService)
    ocrServiceRegistry.register(iflytekLatexOcrService)
    ocrServiceRegistry.register(simpleLatexOcrService)
    ocrServiceRegistry.register(qrcodeOcrService)
    ocrServiceRegistry.register(systemOcrService)
}
