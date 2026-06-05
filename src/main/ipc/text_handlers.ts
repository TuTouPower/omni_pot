import { clipboard, ipcMain, nativeImage } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { getSelectedText } from '../selection'
import { assert_sender_label } from './sender_validation'

const text_clipboard_labels = [WindowLabel.CONFIG, WindowLabel.TRANSLATE, WindowLabel.DICT, WindowLabel.RECOGNIZE, WindowLabel.SCREENSHOT] as const

export function registerTextHandlers(manager: WindowManager): void {
    ipcMain.handle('text:getSelection', async (event): Promise<string> => {
        assert_sender_label(manager, event, [WindowLabel.CONFIG], 'text:getSelection')
        return getSelectedText()
    })
    ipcMain.handle('text:writeClipboard', (event, text: string): void => {
        assert_sender_label(manager, event, text_clipboard_labels, 'text:writeClipboard')
        clipboard.writeText(text)
    })
    ipcMain.handle('text:write_clipboard_image', (event, base64_image: string): void => {
        assert_sender_label(manager, event, [WindowLabel.RECOGNIZE], 'text:write_clipboard_image')
        const MAX_BASE64_LENGTH = 20 * 1024 * 1024 // 20MB base64 ≈ 15MB raw image
        if (base64_image.length > MAX_BASE64_LENGTH) {
            throw new Error('Clipboard image too large')
        }
        const image = nativeImage.createFromDataURL(`data:image/png;base64,${base64_image}`)
        if (image.isEmpty()) throw new Error('Invalid clipboard image')
        clipboard.writeImage(image)
    })
}
