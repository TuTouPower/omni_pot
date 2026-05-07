import { ipcMain } from 'electron'
import { getSelectedText } from '../selection'

export function registerTextHandlers(): void {
    ipcMain.handle('text:getSelection', async (): Promise<string> => getSelectedText())
}
