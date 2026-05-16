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
