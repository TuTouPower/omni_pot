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

    translateButton(): Locator {
        return this.page.getByTestId('ocr-translate-btn')
    }

    clickPin(): Promise<void> {
        return this.pinButton().click()
    }

    clickClose(): Promise<void> {
        return this.closeButton().click()
    }
}
