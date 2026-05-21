import { clipboard, ipcMain, nativeImage } from 'electron'
import { getSelectedText } from '../selection'

export function registerTextHandlers(): void {
    ipcMain.handle('text:getSelection', async (): Promise<string> => getSelectedText())
    ipcMain.handle('text:writeClipboard', (_event, text: string): void => {
        clipboard.writeText(text)
    })
    ipcMain.handle('text:writeClipboardImage', (_event, base64_image: string): void => {
        const image = nativeImage.createFromDataURL(`data:image/png;base64,${base64_image}`)
        if (image.isEmpty()) throw new Error('Invalid clipboard image')
        clipboard.writeImage(image)
    })
}
