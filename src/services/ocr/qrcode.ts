import jsQR from 'jsqr'
import type { OcrService } from '@shared/types/ocr_service'
import type { LanguageCode } from '@shared/types/language'
import type { ServiceConfig } from '@shared/types/service'

const QRCODE_LANGUAGES: LanguageCode[] = [
    'auto', 'zh_cn', 'zh_tw', 'en', 'ja', 'ko', 'fr', 'es', 'ru',
    'de', 'it', 'tr', 'pt_pt', 'pt_br', 'vi', 'id', 'th', 'ms', 'ar',
    'hi', 'fa', 'pl', 'nl', 'uk'
]

function base64_to_image_data(base64: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Failed to get canvas context'))
                return
            }
            ctx.drawImage(img, 0, 0)
            resolve(ctx.getImageData(0, 0, canvas.width, canvas.height))
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = `data:image/png;base64,${base64}`
    })
}

export const qrcodeOcrService: OcrService = {
    key: 'qrcode',
    name: 'QR Code',
    languages: QRCODE_LANGUAGES,

    async recognize(
        base64Image: string,
        _language: LanguageCode,
        _config: ServiceConfig
    ): Promise<string> {
        const image_data = await base64_to_image_data(base64Image)
        const code = jsQR(image_data.data, image_data.width, image_data.height)
        if (!code) {
            return ''
        }
        return code.data
    },

    async testConfig(_config: ServiceConfig): Promise<boolean> {
        return true
    }
}
