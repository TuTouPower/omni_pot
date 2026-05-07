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

        manager.focusOrCreate(WindowLabel.RECOGNIZE, {
            label: WindowLabel.RECOGNIZE,
            width: 400,
            height: 350,
            minWidth: 300,
            minHeight: 200
        })

        manager.sendWhenReady(WindowLabel.RECOGNIZE, 'recognize:show', base64Image, text)
    })

    ipcMain.handle('ocr:send-to-translate', async (_event, text: string) => {
        const win = manager.focusOrCreate(WindowLabel.TRANSLATE, {
            label: WindowLabel.TRANSLATE,
            width: 350,
            height: 420
        })
        manager.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-api', text)
    })
}
