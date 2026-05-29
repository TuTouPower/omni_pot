import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import type { RecognizePage } from '../pages/recognize_page'
import { local_translation_timeout_ms, ocr_test_timeout_ms, ocr_timeout_ms } from '../fixtures/timeout_constants'

const recognize_config = {
    app_language: 'zh_cn',
    welcome_dismissed: true,
    recognize_delete_newline: false,
    recognize_engine: 'system@default',
    recognize_service_list: ['system@default', 'tesseract@default'],
    service_instances: {
        'system@default': { serviceKey: 'system', config: {} },
        'tesseract@default': { serviceKey: 'tesseract', config: {} },
    },
}

const recognize_disable_config = {
    app_language: 'zh_cn',
    welcome_dismissed: true,
    recognize_service_list: ['baidu_ocr@disabled', 'baidu_accurate_ocr@enabled'],
    service_instances: {
        'baidu_ocr@disabled': {
            serviceKey: 'baidu_ocr',
            config: { client_id: 'disabled', client_secret: 'disabled' },
        },
        'baidu_accurate_ocr@enabled': {
            serviceKey: 'baidu_accurate_ocr',
            config: { client_id: 'enabled', client_secret: 'enabled' },
        },
    },
}

const qrcode_config = {
    app_language: 'zh_cn',
    welcome_dismissed: true,
    recognize_service_list: ['qrcode@default'],
    service_instances: {
        'qrcode@default': { serviceKey: 'qrcode', config: {} },
    },
}

const qrcode_auto_detect_config = {
    app_language: 'zh_cn',
    welcome_dismissed: true,
    recognize_engine: 'baidu_ocr@default',
    recognize_service_list: ['baidu_ocr@default', 'qrcode@default'],
    service_instances: {
        'baidu_ocr@default': {
            serviceKey: 'baidu_ocr',
            config: { client_id: 'enabled', client_secret: 'enabled' },
        },
        'qrcode@default': { serviceKey: 'qrcode', config: {} },
    },
}

const qrcode_image = 'iVBORw0KGgoAAAANSUhEUgAAASIAAAEiCAIAAADS3EjhAAAEgUlEQVR4nO3dSW7DMBAAQSvI/7+s/IAIoHS4qOqexZYbc/CAvO77/gClr/S3AzKD/2CaQU5mkJMZ5GQGOZlBTmaQkxnkZAY5mUFOZpCTGeRkBjmZQU5mkJMZ5GQGOZlBTmaQkxnkZAY5mUFOZpCTGeRkBjmZQU5mkJMZ5GQGOZlBTmaQkxnkZAY5mUFOZpCTGeRkBjmZQU5mkJMZ5GQGOZlBTmaQkxnkZAY5mUFOZpCTGeRkBjmZQe77M8l1XZ+z3Pc95b0a/93uZ3d0Z89ozDSDnMwgJzPIyQxyMoOczCAnM8jJDHIyg3O3QNb8tn5s1lbEmrsantHvmWaQkxnkZAY5mUFOZpCTGeRkBjmZQU5m8NYtkLFu72HWZsOTEzt2fEXnbZ+MmWaQkxnkZAY5mUFOZpCTGeRkBjmZQU5mkNtyC2RHa97qsuNGxY5MM8jJDHIyg5zMICczyMkMcjKDnMwgJzPI2QLZ3qwbYfg90wxyMoOczCAnM8jJDHIyg5zMICczyMkMcltugex4gsWO//MTb3u9Y6YZ5GQGOZlBTmaQkxnkZAY5mUFOZpCTGbx1C+S88y26m1me3AjzxHnPqGOaQU5mkJMZ5GQGOZlBTmaQkxnkZAY5mUHucmbDCmZtVHj6/8M0g5zMICczyMkMcjKDnMwgJzPIyQxyMoNzzwJ5svfQ7S502xg7nvZx3vOdxTSDnMwgJzPIyQxyMoOczCAnM8jJDHIyg7eeBTJrG6O7t2XWzsSaOyJjT97nWU9wzDSDnMwgJzPIyQxyMoOczCAnM8jJDHIyg9yBWyBr7mqsuckx6+lfx72iMdMMcjKDnMwgJzPIyQxyMoOczCAnM8jJDN66BdLpzoqYdZ5Ht0HilJG/YppBTmaQkxnkZAY5mUFOZpCTGeRkBjmZQe77s6Ru72HWzsTYrHtbZt2Pcy151kvHNIOczCAnM8jJDHIyg5zMICczyMkMcjKD3OvOApll1m5Kp9sCuY/7TJpmkJMZ5GQGOZlBTmaQkxnkZAY5mUFOZnDuWSBrbjbsuBWx4zt5v2yDxDSDnMwgJzPIyQxyMoOczCAnM5AZ7M80g7feCLPmd/ndvsWse2q6V7Tme3VP+lyZZpCTGeRkBjmZQU5mkJMZ5GQGOZlBTmbw1i2QNTcMut+85nkes/YtrmzrZRbTDHIyg5zMICczyMkMcjKDnMwgJzPIyQxyW26BnKfbEVnzbIzzTvsYM80gJzPIyQxyMoOczCAnM8jJDHIyg5zMIGcLZHtrbpB0Pzu25o6IaQY5mUFOZpCTGeRkBjmZQU5mkJMZ5GQGuS23QNY872HNW0523NU47+mbZpCTGeRkBjmZQU5mkJMZ5GQGOZlBTmbw1i2QJ1sCO1pzV2Ns1t+9ljztY8w0g5zMICczyMkMcjKDnMwgJzPIyQxyMoPctea35nAS0wxyMoOczCAnM8jJDHIyg5zMICczyMkMcjKDnMwgJzPIyQxyMoOczCAnM8jJDHIyg5zMICczyMkMcjKDnMwgJzPIyQxyMoOczCAnM8jJDHIyg5zMICczyMkMcjKDnMwgJzPIyQxyMoOczOBT+wFmUwFSAjkJ1wAAAABJRU5ErkJggg=='

async function sample_ocr_image(page: Page): Promise<string> {
    return page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = 900
        canvas.height = 260
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context unavailable')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#000000'
        ctx.font = '700 96px Arial'
        ctx.fillText('HELLO OCR TEST', 44, 160)
        return canvas.toDataURL('image/png').replace('data:image/png;base64,', '')
    })
}

async function open_recognize_with_image(omni: AppFixture, image: string, text: string, mode: 'recognize' | 'translate' = 'recognize'): Promise<RecognizePage> {
    const page = await omni.firstWindow()
    await page.evaluate(({ image, text, mode }) => window.electronAPI.ocr.open_recognize(image, text, mode), { image, text, mode })
    return omni.recognize()
}

async function open_recognize_with_sample(omni: AppFixture, text: string, mode: 'recognize' | 'translate' = 'recognize'): Promise<RecognizePage> {
    const page = await omni.firstWindow()
    const image = await sample_ocr_image(page)
    return open_recognize_with_image(omni, image, text, mode)
}

test.describe('@ui recognize window', () => {
    test('user edits OCR result and uses recognition window controls', async () => {
        const omni = await AppFixture.start({ config: recognize_config })

        try {
            const recognize = await open_recognize_with_sample(omni, 'Line one\nLine two with spaces')

            await expect(recognize.wordmark()).toContainText('Omni Pot')
            const bounds = (await omni.api.windowState('recognize')).bounds
            if (!bounds) throw new Error('Recognize window bounds unavailable')
            expect(bounds.width).toBeGreaterThanOrEqual(600)
            expect(bounds.height).toBeGreaterThanOrEqual(420)
            const viewport = await recognize.viewportMetrics()
            expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 1)
            expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.innerHeight + 1)
            expect(viewport.shellBottom).toBeGreaterThanOrEqual(viewport.innerHeight - 1)
            await expect(recognize.modeLabel()).toContainText('识别')
            expect(await recognize.titlebarOrder()).toEqual(['topmost', 'pin', 'wordmark', 'mode', 'close'])
            await expect(recognize.image().locator('img')).toBeVisible()
            await expect(recognize.text()).toHaveValue('Line one\nLine two with spaces')

            await expect(recognize.engineSelect()).toHaveAttribute('role', 'combobox')
            await expect(recognize.engineSelect()).toHaveAttribute('aria-expanded', 'false')
            await recognize.engineSelect().focus()
            await recognize.page.keyboard.press('Space')
            await expect(recognize.engineSelect()).toHaveAttribute('aria-expanded', 'true')
            await expect(recognize.engineOption('system@default')).toHaveAttribute('role', 'option')
            await expect(recognize.engineOption('system@default')).toContainText('系统文字识别')
            await expect(recognize.engineOption('tesseract@default')).toContainText('Tesseract')
            await recognize.page.keyboard.press('ArrowUp')
            await recognize.page.keyboard.press('Enter')
            await expect(recognize.engineSelect()).toContainText('Tesseract')

            await recognize.clickLanguageSelect()
            await expect(recognize.languageOption('auto')).toContainText('自动检测')
            await recognize.languageOption('en').click()
            await expect(recognize.languageSelect()).toContainText('English')

            // Spec §8.5: switching recognize language auto re-recognizes.
            // The text area should be refreshed with a new OCR result.
            await expect.poll(async () => (await recognize.getText()).length > 0,
                { timeout: ocr_timeout_ms }).toBe(true)

            await recognize.setText('Line one\nLine two with spaces')
            await recognize.clickDeleteNewline()
            await expect(recognize.text()).toHaveValue('Line one Line two with spaces')

            await recognize.setText('A B\nC D')
            await recognize.clickDeleteSpace()
            await expect(recognize.text()).toHaveValue('AB\nCD')

            await recognize.clickCopy()
            await expect.poll(async () => (await omni.api.readClipboard()).text).toBe('AB\nCD')

            await recognize.click_copy_image()
            await expect.poll(async () => (await omni.api.read_clipboard_image()).is_empty).toBe(false)
            await expect.poll(async () => (await omni.api.read_clipboard_image()).size).toEqual({ width: 900, height: 260 })

            await recognize.clickPin()
            await expect(recognize.pinButton()).toHaveAttribute('aria-pressed', 'true')

            await recognize.clickExport()
            await expect(recognize.exportOption('md')).toContainText('.md')
            await expect(recognize.exportOption('txt')).toContainText('.txt')
            await expect(recognize.exportOption('docx')).toContainText('.docx')
            await expect(recognize.exportOption('doc')).toContainText('.doc')
            await recognize.clickExport()

            await expect(recognize.image()).not.toContainText(/尺寸|类型|字数|耗时/)
            await expect(recognize.text()).not.toContainText(/尺寸|类型|字数|耗时/)

            await recognize.setText('ABC')
            await recognize.clickTranslate()
            await expect(recognize.modeLabel()).toContainText('翻译')
            await expect(recognize.text()).toHaveValue('ABC')
            await expect(recognize.translation()).toContainText('ABC')

            await recognize.clickClose()
            await expect.poll(async () => (await omni.api.windowState('recognize')).visible).toBe(false)
        } finally {
            await omni.stop()
        }
    })

    test('recognize result follows delete-newline and auto-copy config', async () => {
        const omni = await AppFixture.start({
            config: {
                ...recognize_config,
                recognize_delete_newline: true,
                recognize_auto_copy: true,
            },
        })

        try {
            const recognize = await open_recognize_with_sample(omni, 'Auto\nCopy Text')

            await expect(recognize.text()).toHaveValue('Auto Copy Text')
            await expect.poll(async () => (await omni.api.readClipboard()).text).toBe('Auto Copy Text')
        } finally {
            await omni.stop()
        }
    })

    test('user disables the selected OCR service and re-recognize falls back to an enabled service (stubbed)', async () => {
        const omni = await AppFixture.start({ config: recognize_disable_config })

        try {
            const recognize = await open_recognize_with_sample(omni, 'initial text')
            await recognize.fulfill_baidu_ocr_services('启用服务结果', '停用服务不应显示')

            await recognize.clickEngineSelect()
            await recognize.engineOption('baidu_ocr@disabled').click()
            await expect(recognize.engineSelect()).toContainText('百度文字识别')
            await omni.api.setConfig({
                service_instances: {
                    ...recognize_disable_config.service_instances,
                    'baidu_ocr@disabled': {
                        ...recognize_disable_config.service_instances['baidu_ocr@disabled'],
                        config: { ...recognize_disable_config.service_instances['baidu_ocr@disabled'].config, enable: false },
                    },
                },
            })

            await expect(recognize.engineSelect()).toContainText('百度高精度')
            // Disabling the selected service triggers auto re-recognize with the fallback.
            await expect.poll(async () => (await recognize.getText()).length > 0,
                { timeout: ocr_timeout_ms }).toBe(true)
            await expect(recognize.text()).toHaveValue('启用服务结果')
        } finally {
            await omni.stop()
        }
    })

    test('user reruns OCR with local QR Code engine', async () => {
        const omni = await AppFixture.start({ config: qrcode_config })

        try {
            const recognize = await open_recognize_with_image(omni, qrcode_image, '')
            await expect(recognize.engineSelect()).toContainText('二维码')

            // QR code recognition happens automatically on open.
            await expect.poll(async () => (await recognize.getText()).length > 0,
                { timeout: ocr_timeout_ms }).toBe(true)
            await expect(recognize.text()).toHaveValue('OMNI_POT_QR_TEST')
        } finally {
            await omni.stop()
        }
    })

    test('user gets QR content automatically even when selected OCR engine is not QR Code', async () => {
        const omni = await AppFixture.start({
            config: qrcode_auto_detect_config,
            init_script: `
                window.__baidu_ocr_request_count = 0;
                const original_fetch = window.fetch.bind(window);
                const mock_response = (data) => new Response(JSON.stringify(data), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                });
                window.fetch = async (input, init) => {
                    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
                    if (url.startsWith('https://aip.baidubce.com/oauth/2.0/token')) {
                        window.__baidu_ocr_request_count += 1;
                        return mock_response({ access_token: 'e2e-token', expires_in: 3600 });
                    }
                    if (url.startsWith('https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic')) {
                        window.__baidu_ocr_request_count += 1;
                        return mock_response({ words_result: [{ words: '普通 OCR 结果不应显示' }] });
                    }
                    return original_fetch(input, init);
                };
            `,
        })

        try {
            const recognize = await open_recognize_with_image(omni, qrcode_image, '')

            await expect(recognize.engineSelect()).toContainText('二维码')
            await expect.poll(async () => (await recognize.getText()).length > 0,
                { timeout: ocr_timeout_ms }).toBe(true)
            await expect(recognize.text()).toHaveValue('OMNI_POT_QR_TEST')
            await expect.poll(async () => recognize.page.evaluate(() => (window as unknown as { __baidu_ocr_request_count?: number }).__baidu_ocr_request_count ?? 0)).toBe(0)

            const non_qr_image = await sample_ocr_image(recognize.page)
            await recognize.page.evaluate(({ image }) => window.electronAPI.ocr.open_recognize(image, '', 'recognize'), { image: non_qr_image })
            await expect(recognize.engineSelect()).toContainText('百度文字识别')
            await expect.poll(async () => (await recognize.getText()).length > 0,
                { timeout: ocr_timeout_ms }).toBe(true)
            await expect(recognize.text()).toHaveValue('普通 OCR 结果不应显示')
        } finally {
            await omni.stop()
        }
    })

    test('user reruns OCR with system engine after switching engines', async () => {
        test.setTimeout(ocr_test_timeout_ms)
        const omni = await AppFixture.start({ config: recognize_config })

        try {
            const recognize = await open_recognize_with_sample(omni, '')

            await recognize.clickLanguageSelect()
            await recognize.languageOption('en').click()

            await recognize.setText('')
            await recognize.clickEngineSelect()
            await recognize.engineOption('tesseract@default').click()
            await expect(recognize.engineSelect()).toContainText('Tesseract')

            await recognize.clickEngineSelect()
            await recognize.engineOption('system@default').click()
            // Switching engine triggers auto re-recognize.
            await expect.poll(async () => (await recognize.getText()).toUpperCase(), { timeout: ocr_timeout_ms }).toContain('OCR')
        } finally {
            await omni.stop()
        }
    })

    test('screenshot translate mode target language dropdown excludes auto and re-translates on change', async () => {
        const omni = await AppFixture.start({ config: recognize_config })
        const server = await omni.startTranslationTestServer()
        server.set_mymemory_response({ translated_text: 'TARGET_LANG_CHANGED', status: 200 })

        try {
            const recognize = await open_recognize_with_sample(omni, 'Line one\nLine two with spaces', 'translate')

            await expect(recognize.modeLabel()).toContainText('翻译')
            await expect(recognize.modeLabel()).not.toContainText('文字识别')

            // Open target language dropdown and verify 'auto' is not present
            const target_select = recognize.page.getByTestId('ocr-target-lang-select')
            await expect(target_select).toBeVisible()
            await target_select.click()
            const auto_option = recognize.page.getByTestId('ocr-target-lang-select-option-auto')
            await expect(auto_option).toHaveCount(0)

            const en_option = recognize.page.getByTestId('ocr-target-lang-select-option-en')
            await expect(en_option).toBeVisible()
            await en_option.click()
            await expect(target_select).toContainText('English')

            // Spec §8.5: 切换翻译目标语言后必须自动重新翻译。
            await expect(recognize.page.getByTestId('ocr-translation')).toContainText('TARGET_LANG_CHANGED', { timeout: local_translation_timeout_ms })

            // Source language dropdown still has 'auto'
            await recognize.clickLanguageSelect()
            await expect(recognize.languageOption('auto')).toContainText('自动检测')
        } finally {
            await server.stop()
            await omni.stop()
        }
    })

    test('user reruns OCR with tesseract after switching engines', async () => {
        test.setTimeout(ocr_test_timeout_ms)
        const omni = await AppFixture.start({ config: recognize_config })

        try {
            const recognize = await open_recognize_with_sample(omni, '')

            await recognize.clickLanguageSelect()
            await recognize.languageOption('en').click()

            await recognize.setText('')
            await recognize.clickEngineSelect()
            await recognize.engineOption('system@default').click()
            await expect(recognize.engineSelect()).toContainText('系统文字识别')

            await recognize.clickEngineSelect()
            await recognize.engineOption('tesseract@default').click()
            // Switching engine triggers auto re-recognize.
            await expect.poll(async () => (await recognize.getText()).toUpperCase(), { timeout: ocr_timeout_ms }).toContain('OCR')
        } finally {
            await omni.stop()
        }
    })
})
