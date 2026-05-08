import { ipcMain } from 'electron'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { start_screenshot_capture } from '../screenshot'
import { getConfig, setConfig } from '../config/store'

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
        const rememberSize = getConfig('translate_remember_window_size') as boolean
        const w = rememberSize ? (getConfig('translate_window_width') as number) : 350
        const h = rememberSize ? (getConfig('translate_window_height') as number) : 420

        const win = manager.focusOrCreate(WindowLabel.TRANSLATE, {
            label: WindowLabel.TRANSLATE,
            width: w,
            height: h
        })

        if (rememberSize) {
            win.on('resize', () => {
                const [cw, ch] = win.getSize()
                setConfig('translate_window_width', cw)
                setConfig('translate_window_height', ch)
            })
        }

        manager.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-api', text)
    })
}
