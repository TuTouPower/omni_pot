import type { Locator, Page } from '@playwright/test'

export class RecognizePage {
    constructor(private page: Page) {}

    wordmark(): Locator {
        return this.page.getByTestId('titlebar-wordmark')
    }

    modeLabel(): Locator {
        return this.page.getByTestId('titlebar-mode')
    }

    pinButton(): Locator {
        return this.page.getByTestId('titlebar-pin')
    }

    closeButton(): Locator {
        return this.page.getByTestId('titlebar-close')
    }

    image(): Locator {
        return this.page.getByTestId('ocr-image')
    }

    text(): Locator {
        return this.page.getByTestId('ocr-text')
    }

    engineSelect(): Locator {
        return this.page.getByTestId('ocr-engine-select')
    }

    languageSelect(): Locator {
        return this.page.getByTestId('ocr-lang-select')
    }

    reRecognizeButton(): Locator {
        return this.page.getByTestId('ocr-reocr-btn')
    }

    deleteNewlineButton(): Locator {
        return this.page.getByTestId('ocr-newline-btn')
    }

    deleteSpaceButton(): Locator {
        return this.page.getByTestId('ocr-space-btn')
    }

    copyButton(): Locator {
        return this.page.getByTestId('ocr-copy-btn')
    }

    exportButton(): Locator {
        return this.page.getByTestId('ocr-export-btn')
    }

    exportOption(format: 'md' | 'txt' | 'docx' | 'doc'): Locator {
        return this.page.getByTestId(`ocr-export-option-${format}`)
    }

    translateButton(): Locator {
        return this.page.getByTestId('ocr-translate-btn')
    }

    clickPin(): Promise<void> {
        return this.pinButton().click()
    }

    async clickClose(): Promise<void> {
        const close_promise = this.page.waitForEvent('close').catch(() => undefined)
        try {
            await this.closeButton().click()
        } catch (error) {
            if (!this.page.isClosed()) throw error
        }
        await close_promise
    }

    clickEngineSelect(): Promise<void> {
        return this.engineSelect().click()
    }

    engineOption(instanceKey: string): Locator {
        return this.page.getByTestId(`ocr-engine-select-option-${instanceKey}`)
    }

    clickLanguageSelect(): Promise<void> {
        return this.languageSelect().click()
    }

    languageOption(language: string): Locator {
        return this.page.getByTestId(`ocr-lang-select-option-${language}`)
    }

    clickReRecognize(): Promise<void> {
        return this.reRecognizeButton().click()
    }

    clickDeleteNewline(): Promise<void> {
        return this.deleteNewlineButton().click()
    }

    clickDeleteSpace(): Promise<void> {
        return this.deleteSpaceButton().click()
    }

    clickCopy(): Promise<void> {
        return this.copyButton().click()
    }

    clickExport(): Promise<void> {
        return this.exportButton().click()
    }

    clickTranslate(): Promise<void> {
        return this.translateButton().click()
    }

    getText(): Promise<string> {
        return this.text().inputValue()
    }

    viewportMetrics(): Promise<{ innerWidth: number; innerHeight: number; scrollWidth: number; scrollHeight: number; shellBottom: number }> {
        return this.page.evaluate(() => {
            const shell = document.querySelector('.op-window')?.getBoundingClientRect()
            return {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight,
                shellBottom: shell?.bottom ?? 0,
            }
        })
    }

    setText(text: string): Promise<void> {
        return this.text().fill(text)
    }

    /** @stubbed Page-level fetch interceptor — stubs Baidu OCR token + general_basic/accurate_basic responses.
     *  Used only for UI routing tests (enable/disable service display). Real OCR is covered by Tesseract engine tests. */
    async fulfill_baidu_ocr_services(enabled_text: string, disabled_text: string): Promise<void> {
        await this.page.evaluate(({ enabled_text, disabled_text }: { enabled_text: string; disabled_text: string }) => {
            const original_fetch = window.fetch.bind(window)
            const mock_response = (data: unknown): Response => new Response(JSON.stringify(data), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
                if (url.startsWith('https://aip.baidubce.com/oauth/2.0/token')) {
                    return mock_response({ access_token: 'e2e-token', expires_in: 3600 })
                }
                if (url.startsWith('https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic')) {
                    return mock_response({ words_result: [{ words: disabled_text }] })
                }
                if (url.startsWith('https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic')) {
                    return mock_response({ words_result: [{ words: enabled_text }] })
                }
                return original_fetch(input, init)
            }
        }, { enabled_text, disabled_text })
    }

    titlebarOrder(): Promise<string[]> {
        const items = [
            { name: 'pin', locator: this.pinButton() },
            { name: 'wordmark', locator: this.wordmark() },
            { name: 'mode', locator: this.modeLabel() },
            { name: 'close', locator: this.closeButton() },
        ]
        return Promise.all(items.map(async (item) => {
            const box = await item.locator.boundingBox()
            return { name: item.name, x: box?.x ?? Number.POSITIVE_INFINITY }
        })).then((positions) => positions.sort((a, b) => a.x - b.x).map((item) => item.name))
    }
}
