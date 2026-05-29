import { afterEach, describe, expect, it, vi } from 'vitest'
import { get_macos_ocr_script_path, normalize_system_ocr_language, registerOcrHandlers } from '../../../electron/ipc/ocr_handlers'
import { WindowLabel } from '../../../electron/windows/types'
import { normalize_recognized_text } from '@shared/text_normalize'

const mocks = vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    chmod: vi.fn(),
    execFile: vi.fn(),
    fromWebContents: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    writeFile: vi.fn(),
}))

vi.mock('electron', () => ({
    app: {
        get isPackaged() {
            return false
        },
    },
    BrowserWindow: {
        fromWebContents: mocks.fromWebContents,
    },
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            mocks.handlers.set(channel, handler)
        }),
    },
}))

vi.mock('fs/promises', () => ({
    default: {
        chmod: mocks.chmod,
        mkdir: mocks.mkdir,
        rm: mocks.rm,
        writeFile: mocks.writeFile,
    },
    chmod: mocks.chmod,
    mkdir: mocks.mkdir,
    rm: mocks.rm,
    writeFile: mocks.writeFile,
}))

vi.mock('child_process', () => ({
    default: { execFile: mocks.execFile },
    execFile: mocks.execFile,
}))

afterEach(() => {
    vi.restoreAllMocks()
    mocks.handlers.clear()
    vi.clearAllMocks()
})

describe('registerOcrHandlers', () => {
    it('accepts existing recursive temp directory when mkdir returns undefined', async () => {
        vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
        mocks.mkdir.mockResolvedValue(undefined)
        mocks.chmod.mockResolvedValue(undefined)
        mocks.writeFile.mockResolvedValue(undefined)
        mocks.rm.mockResolvedValue(undefined)
        mocks.execFile.mockImplementation((
            _file: string,
            _args: string[],
            _options: unknown,
            callback: (error: Error | null, stdout: string, stderr: string) => void,
        ) => {
            callback(null, 'recognized text\n', '')
        })

        mocks.fromWebContents.mockReturnValue({ id: 9 })
        registerOcrHandlers({
            focusOrCreate: vi.fn(),
            sendWhenReady: vi.fn(),
            getLabelById: vi.fn(() => WindowLabel.RECOGNIZE),
        } as never)

        const handler = mocks.handlers.get('ocr:system-recognize')
        await expect(handler?.({ sender: { id: 42 } }, Buffer.from('image').toString('base64'), 'en-US')).resolves.toBe('recognized text')

        const temp_dir = mocks.mkdir.mock.calls[0]?.[0] as string
        expect(typeof temp_dir).toBe('string')
        expect(mocks.chmod).toHaveBeenCalledWith(temp_dir, 0o700)
        expect(mocks.writeFile).toHaveBeenCalledWith(expect.stringContaining('image.png'), expect.any(Buffer))
        expect(mocks.rm).toHaveBeenCalledWith(temp_dir, { recursive: true, force: true })
    })
})

describe('normalize_system_ocr_language', () => {
    it('accepts known Windows OCR language tags', () => {
        expect(normalize_system_ocr_language('')).toBe('en-US')
        expect(normalize_system_ocr_language('en-US')).toBe('en-US')
        expect(normalize_system_ocr_language('zh-CN')).toBe('zh-CN')
    })

    it('rejects language tags that could escape the PowerShell string', () => {
        expect(() => normalize_system_ocr_language("en-US'); Write-Error 'owned")).toThrow('Unsupported OCR language')
    })
})

describe('get_macos_ocr_script_path', () => {
    it('uses the development scripts path before packaging', () => {
        expect(get_macos_ocr_script_path().replaceAll('\\', '/')).toContain('/scripts/macos_ocr.swift')
    })
})

describe('normalize_recognized_text', () => {
    it('removes hyphenation followed by whitespace', () => {
        expect(normalize_recognized_text('recogni-\ntion')).toBe('recognition')
        expect(normalize_recognized_text('multi-  \n  ple')).toBe('multiple')
    })

    it('collapses multiple whitespace into single space', () => {
        expect(normalize_recognized_text('hello   world')).toBe('hello world')
        expect(normalize_recognized_text('a\n\n\nb')).toBe('a b')
        expect(normalize_recognized_text('a\t\tb')).toBe('a b')
    })

    it('combines hyphenation removal and whitespace collapse', () => {
        expect(normalize_recognized_text('Line one\nLine two with spaces')).toBe('Line one Line two with spaces')
    })

    it('does not trim leading/trailing whitespace', () => {
        expect(normalize_recognized_text('  hello  ')).toBe(' hello ')
        // The function only collapses internal whitespace; trimming is done by the caller.
    })

    it('returns empty string unchanged', () => {
        expect(normalize_recognized_text('')).toBe('')
    })
})
