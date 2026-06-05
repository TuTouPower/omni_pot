import { randomUUID } from 'node:crypto'
import { app, ipcMain } from 'electron'
import { execFile } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, mkdir, rm, chmod } from 'fs/promises'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { start_screenshot_capture } from '../screenshot'
import { get_translate_window_options } from '../windows/translate_options'
import { get_recognize_window_options } from '../windows/recognize_options'
import { assert_sender_label } from './sender_validation'

const SYSTEM_OCR_LANGUAGES = new Set([
    'en-US', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR', 'fr-FR', 'es-ES', 'ru-RU',
    'de-DE', 'it-IT', 'tr-TR', 'pt-PT', 'pt-BR', 'vi-VN', 'id-ID', 'th-TH',
    'ms-MY', 'ar-SA', 'hi-IN', 'fa-IR', 'pl-PL', 'nl-NL', 'uk-UA',
])

export function normalize_system_ocr_language(lang: string): string {
    if (!lang) return 'en-US'
    if (!SYSTEM_OCR_LANGUAGES.has(lang)) throw new Error('Unsupported OCR language')
    return lang
}

async function windows_ocr(image_path: string, lang: string): Promise<string> {
    const bcp47 = normalize_system_ocr_language(lang)
    const ps_script = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrResult, Windows.Media.Ocr, ContentType = WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

function AwaitOp($op, [type]$resultType) {
    $method = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1
    })[0]
    $task = $method.MakeGenericMethod($resultType).Invoke($null, @($op))
    return $task.GetAwaiter().GetResult()
}

$file = AwaitOp ([Windows.Storage.StorageFile]::GetFileFromPathAsync('${image_path.replace(/'/g, "''")}')) ([Windows.Storage.StorageFile])
$stream = AwaitOp ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = AwaitOp ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = AwaitOp ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

$lang = [Windows.Globalization.Language]::new('${bcp47}')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if ($null -eq $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if ($null -eq $engine) { Write-Error 'No OCR engine available'; exit 1 }
$result = AwaitOp ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$result.Text
`
    return new Promise((resolve, reject) => {
        execFile('powershell.exe', [
            '-NoProfile', '-NonInteractive', '-Command', ps_script
        ], { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (err, stdout, stderr) => {
            if (err) {
                const msg = stderr.trim() || err.message
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

const MACOS_VISION_LANGUAGES = new Set([
    'en-US', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR', 'fr-FR', 'es-ES', 'ru-RU',
    'de-DE', 'it-IT', 'pt-PT', 'pt-BR',
])

function normalize_macos_ocr_language(lang: string): string {
    if (!lang) return ''
    if (MACOS_VISION_LANGUAGES.has(lang)) return lang
    const prefix = lang.split('-')[0] ?? ''
    for (const supported of MACOS_VISION_LANGUAGES) {
        if (supported.startsWith(prefix + '-')) return supported
    }
    return ''
}

export function get_macos_ocr_script_path(): string {
    if (app.isPackaged) return join(process.resourcesPath, 'scripts', 'macos_ocr.swift')
    return join(__dirname, '..', '..', 'scripts', 'macos_ocr.swift')
}

async function macos_ocr(image_path: string, lang: string): Promise<string> {
    const bcp47 = normalize_macos_ocr_language(lang)
    const args = [get_macos_ocr_script_path(), image_path]
    if (bcp47) args.push(bcp47)

    return new Promise((resolve, reject) => {
        execFile('swift', args, { timeout: 30000 }, (err, stdout, stderr) => {
            if (err) {
                reject(new Error(stderr.trim() || err.message))
                return
            }
            resolve(stdout.trim())
        })
    })
}

export function registerOcrHandlers(manager: WindowManager): void {
    ipcMain.handle('ocr:capture-screenshot', async (event, mode: 'recognize' | 'translate') => {
        assert_sender_label(manager, event, [WindowLabel.WELCOME, WindowLabel.CONFIG], 'ocr:capture-screenshot')
        return start_screenshot_capture(manager, mode)
    })

    ipcMain.handle('ocr:open-recognize', (event, base64Image: string, text: string, mode?: string) => {
        assert_sender_label(manager, event, [WindowLabel.SCREENSHOT], 'ocr:open-recognize')
        manager.focusOrCreate(WindowLabel.RECOGNIZE, get_recognize_window_options())

        manager.sendWhenReady(WindowLabel.RECOGNIZE, 'recognize:show', base64Image, text, mode ?? 'recognize')
    })

    ipcMain.handle('ocr:send-to-translate', (event, text: string) => {
        assert_sender_label(manager, event, [WindowLabel.RECOGNIZE], 'ocr:send-to-translate')
        manager.focusOrCreate(WindowLabel.TRANSLATE, get_translate_window_options())

        manager.sendWhenReady(WindowLabel.TRANSLATE, 'translate:from-api', text)
    })

    ipcMain.handle('ocr:system-recognize', async (event, base64Image: string, lang: string): Promise<string> => {
        assert_sender_label(manager, event, [WindowLabel.SCREENSHOT, WindowLabel.RECOGNIZE], 'ocr:system-recognize')
        const platform = process.platform

        // Write image to private temp directory
        const tmp_dir = join(tmpdir(), `omni_ocr_${randomUUID()}`)
        await mkdir(tmp_dir, { recursive: true })
        await chmod(tmp_dir, 0o700)
        const tmp_path = join(tmp_dir, 'image.png')
        const buffer = Buffer.from(base64Image, 'base64')
        await writeFile(tmp_path, buffer)

        try {
            if (platform === 'win32') {
                return await windows_ocr(tmp_path, lang)
            } else if (platform === 'darwin') {
                return await macos_ocr(tmp_path, lang)
            } else {
                throw new Error('System OCR not supported on this platform')
            }
        } finally {
            await rm(tmp_dir, { recursive: true, force: true }).catch(() => {})
        }
    })
}
