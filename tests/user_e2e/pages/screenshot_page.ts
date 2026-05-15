import type { Locator, Page } from '@playwright/test'

function is_target_closed_error(error: unknown): boolean {
    return error instanceof Error && error.message.includes('Target page, context or browser has been closed')
}

export class ScreenshotPage {
    constructor(private page: Page) {}

    root(): Locator {
        return this.page.getByTestId('shot-root')
    }

    overlay(): Locator {
        return this.page.getByTestId('shot-overlay')
    }

    selection(): Locator {
        return this.page.getByTestId('shot-selection')
    }

    cornerHandles(): Locator {
        return this.page.getByTestId('shot-corner-handle')
    }

    sizeLabel(): Locator {
        return this.page.getByTestId('shot-size-label')
    }

    hint(): Locator {
        return this.page.getByTestId('shot-hint')
    }

    screen_size(): Promise<{ width: number; height: number }> {
        return this.page.evaluate(() => ({ width: window.screen.width, height: window.screen.height }))
    }

    root_background_image(): Promise<string> {
        return this.root().evaluate((el) => getComputedStyle(el).backgroundImage)
    }

    async fulfill_baidu_ocr_services(enabled_text: string, disabled_text: string): Promise<void> {
        await this.page.route('https://aip.baidubce.com/oauth/2.0/token**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ access_token: 'e2e-token', expires_in: 3600 }),
            })
        })
        await this.page.route('https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ words_result: [{ words: disabled_text }] }),
            })
        })
        await this.page.route('https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ words_result: [{ words: enabled_text }] }),
            })
        })
    }

    async begin_selection(start_x: number, start_y: number, end_x: number, end_y: number): Promise<void> {
        await this.page.mouse.move(start_x, start_y)
        await this.page.mouse.down()
        await this.page.mouse.move(end_x, end_y, { steps: 12 })
    }

    release_selection(): Promise<void> {
        return this.page.mouse.up()
    }

    async drag_and_release(start_x: number, start_y: number, end_x: number, end_y: number): Promise<void> {
        await this.begin_selection(start_x, start_y, end_x, end_y)
        await this.release_selection()
    }

    press_enter(): Promise<void> {
        return this.page.keyboard.press('Enter')
    }

    async press_escape(): Promise<void> {
        try {
            await this.page.keyboard.press('Escape')
        } catch (error) {
            if (!is_target_closed_error(error)) throw error
        }
    }

    async right_click(x: number, y: number): Promise<void> {
        try {
            await this.page.mouse.click(x, y, { button: 'right' })
        } catch (error) {
            if (!is_target_closed_error(error)) throw error
        }
    }
}
