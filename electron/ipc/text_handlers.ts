import { clipboard, ipcMain, nativeImage } from 'electron'
import { getSelectedText } from '../selection'

export function registerTextHandlers(): void {
    ipcMain.handle('text:getSelection', async (): Promise<string> => getSelectedText())
    ipcMain.handle('text:writeClipboard', (_event, text: string): void => {
        clipboard.writeText(text)
    })
    ipcMain.handle('text:write_clipboard_image', (_event, base64_image: string): void => {
        const MAX_BASE64_LENGTH = 20 * 1024 * 1024 // 20MB base64 ≈ 15MB raw image
        if (base64_image.length > MAX_BASE64_LENGTH) {
            throw new Error('Clipboard image too large')
        }
        const image = nativeImage.createFromDataURL(`data:image/png;base64,${base64_image}`)
        if (image.isEmpty()) throw new Error('Invalid clipboard image')
        clipboard.writeImage(image)
    })
}
