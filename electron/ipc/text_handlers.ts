import { clipboard, ipcMain } from 'electron'
import { getSelectedText } from '../selection'

export function registerTextHandlers(): void {
    ipcMain.handle('text:getSelection', async (): Promise<string> => getSelectedText())
    ipcMain.handle('text:writeClipboard', (_event, text: string): void => {
        clipboard.writeText(text)
    })
}
