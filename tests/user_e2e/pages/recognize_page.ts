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

    clickClose(): Promise<void> {
        return this.closeButton().click()
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

    setText(text: string): Promise<void> {
        return this.text().fill(text)
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
