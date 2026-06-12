import { test, expect } from '../fixtures/test'
import { local_operation_timeout_ms } from '../fixtures/timeout_constants'

test.describe('@ui external HTTP API', () => {
    test('POST /translate rejects requests without API token', async ({ omni }) => {
        const response = await omni.api.translate_via_external_api_without_token('external api text')

        expect(response).toEqual({ success: false, error: 'unauthorized' })
    })

    test('POST /translate accepts request body text and focuses translate window with API token', async ({ omni }) => {
        const response = await omni.api.translate_via_external_api('external api text')

        expect(response.success).toBe(true)
        await expect.poll(async () => (await omni.api.windowState('translate')).visible).toBe(true)
        await expect.poll(async () => (await omni.api.windowState('translate')).focused).toBe(true)
        const translate = await omni.translate()
        await expect(translate.sourceInput()).toHaveValue('external api text', { timeout: local_operation_timeout_ms })
    })

    test('GET /config rejects requests without API token', async ({ omni }) => {
        const response = await omni.api.get_config_via_external_api_without_token()

        expect(response).toEqual({ success: false, error: 'unauthorized' })
    })

    test('GET /config returns public config allowlist with API token', async ({ omni }) => {
        await omni.api.setConfig({
            webdav_password: 'webdav-secret',
            service_instances: {
                'bing@default': { serviceKey: 'bing', config: {} },
                'mymemory@default': { serviceKey: 'mymemory', config: { enable: true, instance_name: 'MyMemory E2E', api_key: 'mymemory-secret', custom_url: 'http://127.0.0.1:1' } },
                'tesseract@default': { serviceKey: 'tesseract', config: {} },
                'youdao@default': { serviceKey: 'youdao', config: { enable: true, appkey: 'youdao-appkey', key: 'youdao-secret', endpoint: 'https://api.example.com', instance_name: 'Youdao E2E' } },
            },
        })

        const config = await omni.api.get_config_via_external_api()
        const service_instances = config.service_instances as Record<string, { serviceKey: string; config: Record<string, unknown> }>

        expect(config.server_port).toEqual(expect.any(Number))
        expect(config.welcome_dismissed).toBe(true)
        expect(config.translate_source_language).toBe('auto')
        expect(config.translate_target_language).toBe('zh_cn')
        expect(config.translate_service_list).toEqual(['bing@default', 'google@default', 'deepl@default', 'mymemory@default'])
        expect(config.recognize_service_list).toEqual(['tesseract@default', 'system@default', 'qrcode@default'])
        expect(config.dictionary_service_list).toEqual(['ecdict@default'])
        expect(config).not.toHaveProperty('server_api_token')
        expect(config).not.toHaveProperty('webdav_url')
        expect(config).not.toHaveProperty('webdav_username')
        expect(config).not.toHaveProperty('webdav_password')
        expect(service_instances).toMatchObject({
            'bing@default': { serviceKey: 'bing', config: {} },
            'mymemory@default': { serviceKey: 'mymemory', config: { enable: true, instance_name: 'MyMemory E2E' } },
            'tesseract@default': { serviceKey: 'tesseract', config: {} },
            'youdao@default': { serviceKey: 'youdao', config: { enable: true, instance_name: 'Youdao E2E' } },
        })
        expect(service_instances['mymemory@default'].config).not.toHaveProperty('api_key')
        expect(service_instances['mymemory@default'].config).not.toHaveProperty('custom_url')
        expect(service_instances['youdao@default'].config).not.toHaveProperty('appkey')
        expect(service_instances['youdao@default'].config).not.toHaveProperty('key')
        expect(service_instances['youdao@default'].config).not.toHaveProperty('endpoint')
    })

    test('POST /recognize returns the current stub response without an E2E token', async ({ omni }) => {
        const response = await omni.api.recognize_via_external_api()

        expect(response).toEqual({ success: true, mode: 'recognize' })
    })

    test('POST /dict accepts text and focuses dict window', async ({ omni }) => {
        const response = await omni.api.requestExternal<{ success: boolean }>('POST', '/dict', { text: 'hello' })

        expect(response.success).toBe(true)
        await expect.poll(async () => (await omni.api.windowState('dict')).visible, { timeout: local_operation_timeout_ms }).toBe(true)
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
