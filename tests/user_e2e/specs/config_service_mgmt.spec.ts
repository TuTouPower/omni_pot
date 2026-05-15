import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const SERVICE_CATEGORIES = [
    ['translate_service_list', '翻译', ['bing@default', 'google@default', 'deepl@default']],
    ['dictionary_service_list', '字典', ['free_dictionary@default', 'ecdict@default']],
    ['recognize_service_list', '识别', []],
    ['tts_service_list', '语音合成', []],
    ['collection_service_list', '收藏', []],
] as const

async function expect_config(omni: AppFixture, key: string, value: unknown): Promise<void> {
    await expect.poll(async () => (await omni.api.getConfig())[key]).toEqual(value)
}

test.describe('@ui config service management', () => {
    test('user switches service categories and sees enabled service lists', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()
            await config.openSection('service')

            await expect(config.title()).toContainText('服务')
            await expect(config.route()).toHaveText('/service')
            await expect(config.addServiceButton()).toBeVisible()

            for (const [category, label, service_keys] of SERVICE_CATEGORIES) {
                await config.openServiceCategory(category)
                await expect(config.serviceTab(category)).toHaveAttribute('aria-selected', 'true')
                await expect(config.serviceTab(category)).toContainText(label)
                await expect(config.serviceTab(category)).toContainText(String(service_keys.length))
                await expect.poll(async () => await config.serviceItemKeys()).toEqual([...service_keys])
            }

            await config.openServiceCategory('translate_service_list')
            await expect(config.serviceItem('bing@default')).toContainText('Bing')
            await expect(config.serviceItem('bing@default')).toContainText('bing@default')
            await expect(config.serviceDragHandle('bing@default')).toBeVisible()
            await expect(config.serviceMoveUp('bing@default')).toBeDisabled()
            await expect(config.serviceMoveDown('bing@default')).toBeEnabled()
            await expect(config.serviceDelete('bing@default')).toBeEnabled()
        } finally {
            await omni.stop()
        }
    })

    test('user adds and deletes a built-in translation service instance', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                translate_service_list: ['bing@default'],
                service_instances: {
                    'bing@default': { serviceKey: 'bing', config: {} },
                },
            },
        })

        try {
            const config = await omni.openConfig()
            await config.openSection('service')
            await config.openServiceCategory('translate_service_list')

            await expect.poll(async () => await config.serviceItemKeys()).toEqual(['bing@default'])
            await config.addService('google')

            let google_key = ''
            await expect.poll(async () => {
                const service_list = (await omni.api.getConfig()).translate_service_list as string[]
                google_key = service_list.find((key) => key.startsWith('google@')) ?? ''
                return service_list.length === 2 && !!google_key
            }).toBe(true)
            await expect(config.serviceItem(google_key)).toContainText('Google')
            await expect.poll(async () => {
                const instances = (await omni.api.getConfig()).service_instances as Record<string, { serviceKey: string }>
                return instances[google_key]?.serviceKey
            }).toBe('google')

            await config.deleteService(google_key)

            await expect_config(omni, 'translate_service_list', ['bing@default'])
            await expect.poll(async () => {
                const instances = (await omni.api.getConfig()).service_instances as Record<string, unknown>
                return google_key in instances
            }).toBe(false)
        } finally {
            await omni.stop()
        }
    })

    test('user reorders translation services and sees result cards follow the order', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                translate_service_list: ['bing@default', 'google@default'],
            },
        })

        try {
            const translate = await omni.translate()
            const config = await omni.openConfig()
            await config.openSection('service')
            await config.openServiceCategory('translate_service_list')

            await expect.poll(async () => await config.serviceItemKeys()).toEqual(['bing@default', 'google@default'])
            await expect.poll(async () => await translate.result_card_keys()).toEqual(['bing@default', 'google@default'])

            await config.moveServiceDown('bing@default')

            await expect.poll(async () => await config.serviceItemKeys()).toEqual(['google@default', 'bing@default'])
            await expect_config(omni, 'translate_service_list', ['google@default', 'bing@default'])
            await expect.poll(async () => await translate.result_card_keys()).toEqual(['google@default', 'bing@default'])
        } finally {
            await omni.stop()
        }
    })
})
