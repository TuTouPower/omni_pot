import { test, expect } from '../fixtures/test'

test.describe('@core smoke', () => {
    test('app launches and translate window is visible', async ({ omni }) => {
        const page = await omni.firstWindow()
        await expect(page).toBeTruthy()

        // Titlebar should show wordmark
        const wordmark = page.getByTestId('titlebar-wordmark')
        await expect(wordmark).toContainText('omni_pot')

        // Mode should be translate
        const mode = page.getByTestId('titlebar-mode')
        await expect(mode).toContainText('翻译')

        // Source input should be visible
        const sourceInput = page.getByTestId('source-input')
        await expect(sourceInput).toBeVisible()

        // Translate button should be visible
        const translateBtn = page.getByTestId('source-translate-btn')
        await expect(translateBtn).toBeVisible()
    })

    test('translate via HTTP API fills source and produces results', async ({ omni }) => {
        const result = await omni.api.triggerSelection('hello world')
        expect(result.success).toBe(true)

        const page = await omni.firstWindow()
        const sourceInput = page.getByTestId('source-input')

        // Wait for source text to be filled
        await expect(sourceInput).toHaveValue('hello world', { timeout: 10_000 })

        // Wait for at least one result card
        await page.waitForSelector('[data-result-key]', { timeout: 30_000 })
        const resultCards = page.locator('[data-result-key]')
        await expect(resultCards.first()).toBeVisible()
    })

    test('config API returns config object', async ({ omni }) => {
        const config = await omni.api.getConfig()
        expect(config).toBeTruthy()
        expect(typeof config).toBe('object')
    })
})
