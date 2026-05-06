import { ipcMain } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { start_screenshot_capture } from '../screenshot'

export function registerOcrHandlers(manager: WindowManager): void {
    ipcMain.handle('ocr:capture-screenshot', async (_event, mode: 'recognize' | 'translate') => {
        await start_screenshot_capture(manager, mode)
    })

    ipcMain.handle('ocr:open-recognize', async (event, base64Image: string, text: string) => {
        const { screen } = await import('electron')
        const display = screen.getPrimaryDisplay()
        const { width, height } = display.workAreaSize

        const win = manager.focusOrCreate(WindowLabel.RECOGNIZE, {
            label: WindowLabel.RECOGNIZE,
            width: 400,
            height: 350,
            minWidth: 300,
            minHeight: 200
        })

        win.webContents.send('recognize:show', base64Image, text)
    })

    ipcMain.handle('ocr:send-to-translate', async (_event, text: string) => {
        const translate_win = manager.getWindow(WindowLabel.TRANSLATE)
        if (translate_win) {
            translate_win.webContents.send('translate:from-api', text)
            translate_win.focus()
        } else {
            const win = manager.focusOrCreate(WindowLabel.TRANSLATE, {
                label: WindowLabel.TRANSLATE,
                width: 350,
                height: 420
            })
            win.webContents.send('translate:from-api', text)
        }
    })
}
