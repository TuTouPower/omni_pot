import { test, expect } from '../fixtures/test'

test.describe('@core external HTTP API', () => {
    test('POST /translate accepts request body text and focuses translate window', async ({ omni }) => {
        const response = await omni.api.translate_via_external_api('external api text')

        expect(response.success).toBe(true)
        await expect.poll(async () => (await omni.api.windowState('translate')).visible).toBe(true)
        await expect.poll(async () => (await omni.api.windowState('translate')).focused).toBe(true)
        const translate = await omni.translate()
        await expect(translate.sourceInput()).toHaveValue('external api text', { timeout: 10_000 })
    })

    test('GET /config returns public config with sensitive values redacted without an E2E token', async ({ omni }) => {
        await omni.api.setConfig({
            webdav_password: 'webdav-secret',
            service_instances: {
                'bing@default': { serviceKey: 'bing', config: {} },
                'mymemory@default': { serviceKey: 'mymemory', config: { api_key: 'mymemory-secret', custom_url: 'http://127.0.0.1:1' } },
                'tesseract@default': { serviceKey: 'tesseract', config: {} },
                'youdao@default': { serviceKey: 'youdao', config: { appkey: 'youdao-appkey', key: 'youdao-secret', instanceName: 'Youdao E2E' } },
            },
        })

        const config = await omni.api.get_config_via_external_api()

        expect(config.server_port).toEqual(expect.any(Number))
        expect(config.welcome_dismissed).toBe(true)
        expect(config.translate_source_language).toBe('auto')
        expect(config.translate_target_language).toBe('zh_cn')
        expect(config.translate_service_list).toEqual(['bing@default', 'deepl@default', 'mymemory@default'])
        expect(config.recognize_service_list).toEqual(['tesseract@default', 'system@default', 'qrcode@default'])
        expect(config.dictionary_service_list).toEqual(['chinese_dictionary@default'])
        expect(config.webdav_password).toBe('[redacted]')
        expect(config.service_instances).toMatchObject({
            'bing@default': { serviceKey: 'bing', config: {} },
            'mymemory@default': { serviceKey: 'mymemory', config: { api_key: '[redacted]', custom_url: '[redacted]' } },
            'tesseract@default': { serviceKey: 'tesseract', config: {} },
            'youdao@default': { serviceKey: 'youdao', config: { appkey: '[redacted]', key: '[redacted]', instanceName: 'Youdao E2E' } },
        })
    })

    test('POST /recognize returns the current stub response without an E2E token', async ({ omni }) => {
        const response = await omni.api.recognize_via_external_api()

        expect(response).toEqual({ success: true, mode: 'recognize' })
    })

    test('POST /dict accepts text and focuses dict window', async ({ omni }) => {
        const response = await omni.api.requestExternal<{ success: boolean }>('POST', '/dict', { text: 'hello' })

        expect(response.success).toBe(true)
        await expect.poll(async () => (await omni.api.windowState('dict')).visible, { timeout: 10_000 }).toBe(true)
    })

    test('GET /history returns paginated history', async ({ omni }) => {
        const response = await omni.api.requestExternal<{ success: boolean; data: unknown[]; page: number; page_size: number; total: number }>('GET', '/history?page=1&page_size=5')

        expect(response.success).toBe(true)
        expect(typeof response.total).toBe('number')
        expect(Array.isArray(response.data)).toBe(true)
        expect(response.page).toBe(1)
        expect(response.page_size).toBe(5)
    })
})
