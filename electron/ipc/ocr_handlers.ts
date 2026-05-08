import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, unlink } from 'fs/promises'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { start_screenshot_capture } from '../screenshot'
import { getConfig, setConfig } from '../config/store'

async function windows_ocr(image_path: string, lang: string): Promise<string> {
    const bcp47 = lang || 'en-US'
    const ps_script = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime] | Out-Null

$file = [Windows.Storage.StorageFile]::GetFileFromPathAsync('${image_path.replace(/'/g, "''")}').AsTask().GetAwaiter().GetResult()
$stream = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read).AsTask().GetAwaiter().GetResult()
$decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).AsTask().GetAwaiter().GetResult()
$bitmap = $decoder.GetSoftwareBitmapAsync().AsTask().GetAwaiter().GetResult()

$lang = [Windows.Globalization.Language]::new('${bcp47}')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if ($null -eq $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if ($null -eq $engine) { Write-Error 'No OCR engine available'; exit 1 }
$result = $engine.RecognizeAsync($bitmap).AsTask().GetAwaiter().GetResult()
$result.Text
`
    return new Promise((resolve, reject) => {
        execFile('powershell.exe', [
            '-NoProfile', '-NonInteractive', '-Command', ps_script
        ], { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (err, stdout, stderr) => {
            if (err) {
                const msg = stderr?.trim() || err.message
                if (msg.includes('Language package not installed') || msg.includes('0x00000000')) {
                    reject(new Error('Language package not installed. See: https://learn.microsoft.com/en-us/windows/powertoys/text-extractor#supported-languages'))
                } else {
                    reject(new Error(msg))
                }
                return
            }
            resolve(stdout.trim())
        })
    })
}

async function linux_ocr(image_path: string, lang: string): Promise<string> {
    const args = [image_path, 'stdout']
    if (lang && lang !== 'auto') {
        const tesseract_lang = lang.split('-')[0]
        args.push('-l', tesseract_lang)
    }

    return new Promise((resolve, reject) => {
        execFile('tesseract', args, { timeout: 30000 }, (err, stdout, stderr) => {
            if (err) {
                const msg = stderr?.trim() || err.message
                if (msg.includes('os error 2')) {
                    reject(new Error('Tesseract not installed'))
                } else if (msg.includes('data')) {
                    reject(new Error(`Language data not installed. Install tesseract-ocr-${lang}`))
                } else {
                    reject(new Error(msg))
                }
                return
            }
            resolve(stdout.trim())
        })
    })
}

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

        if (rememberSize && !win.listenerCount('resize')) {
            win.on('resize', () => {
                const [cw, ch] = win.getSize()
                setConfig('translate_window_width', cw)
                setConfig('translate_window_height', ch)
            })
        }

        manager.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-api', text)
    })

    ipcMain.handle('ocr:system-recognize', async (_event, base64Image: string, lang: string): Promise<string> => {
        const platform = process.platform

        // Write image to temp file
        const tmp_path = join(tmpdir(), `omni_pot_ocr_${Date.now()}.png`)
        const buffer = Buffer.from(base64Image, 'base64')
        await writeFile(tmp_path, buffer)

        try {
            if (platform === 'win32') {
                return await windows_ocr(tmp_path, lang)
            } else if (platform === 'linux') {
                return await linux_ocr(tmp_path, lang)
            } else {
                throw new Error('System OCR not supported on this platform')
            }
        } finally {
            await unlink(tmp_path).catch(() => {})
        }
    })
}
