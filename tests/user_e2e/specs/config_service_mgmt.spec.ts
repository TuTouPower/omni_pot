import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const SERVICE_CATEGORIES = [
    ['translate_service_list', '翻译', ['bing@default', 'google@default', 'deepl@default']],
    ['dictionary_service_list', '字典', ['free_dictionary@default', 'ecdict@default']],
    ['recognize_service_list', '识别', ['tesseract@default']],
    ['tts_service_list', '语音合成', ['edge_tts@default']],
    ['collection_service_list', '收藏', []],
] as const

type ServiceInstanceConfig = {
    serviceKey: string
    config: Record<string, unknown>
}

async function expect_config(omni: AppFixture, key: string, value: unknown): Promise<void> {
    await expect.poll(async () => (await omni.api.getConfig())[key]).toEqual(value)
}

async function expect_service_config(omni: AppFixture, instance_key: string, value: Record<string, unknown>): Promise<void> {
    await expect.poll(async () => {
        const instances = (await omni.api.getConfig()).service_instances as Record<string, ServiceInstanceConfig>
        return instances[instance_key].config
    }).toEqual(value)
}

test.describe('@ui config service management', () => {
    test('user switches service categories and sees enabled service lists', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()
            await config.openSection('service')

            await expect(config.title()).toContainText('服务')
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
            await expect(config.serviceToggle('bing@default')).toHaveAttribute('aria-checked', 'true')
            await expect(config.serviceEdit('bing@default')).toBeVisible()
            await expect(config.serviceMoveControls('bing@default')).toHaveCount(0)
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
                return instances[google_key].serviceKey
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

    test('user disables and re-enables a translation service and result cards follow enabled state', async () => {
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

            await expect.poll(async () => await translate.result_card_keys()).toEqual(['bing@default', 'google@default'])
            await config.toggleService('bing@default')

            await expect(config.serviceToggle('bing@default')).toHaveAttribute('aria-checked', 'false')
            await expect_service_config(omni, 'bing@default', { enable: false })
            await expect.poll(async () => await translate.result_card_keys()).toEqual(['google@default'])

            await config.toggleService('bing@default')

            await expect(config.serviceToggle('bing@default')).toHaveAttribute('aria-checked', 'true')
            await expect_service_config(omni, 'bing@default', { enable: true })
            await expect.poll(async () => await translate.result_card_keys()).toEqual(['bing@default', 'google@default'])
        } finally {
            await omni.stop()
        }
    })

    test('user edits tests and saves a translation service instance config', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                translate_service_list: ['lingva@default'],
                service_instances: {
                    'lingva@default': { serviceKey: 'lingva', config: {} },
                },
            },
        })

        try {
            const config = await omni.openConfig()
            await config.openSection('service')
            await config.openServiceCategory('translate_service_list')

            await config.openServiceEditor('lingva@default')
            await expect(config.serviceEditModal()).toBeVisible()
            await config.fillServiceEditor('Lingva E2E', '{\n    "requestPath": "https://lingva.lunar.icu"\n}')
            await config.fulfillLingvaTestOnce()
            await config.testServiceConfig()
            await expect(config.serviceTestStatus()).toContainText('测试成功')
            await config.saveServiceConfig()

            await expect(config.serviceEditModal()).toHaveCount(0)
            await expect(config.serviceItem('lingva@default')).toContainText('Lingva E2E')
            await expect_service_config(omni, 'lingva@default', {
                requestPath: 'https://lingva.lunar.icu',
                instanceName: 'Lingva E2E',
            })
        } finally {
            await omni.stop()
        }
    })

    test('user drags translation services and sees result cards follow the order', async () => {
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

            await config.dragService('bing@default', 'google@default')

            await expect.poll(async () => await config.serviceItemKeys()).toEqual(['google@default', 'bing@default'])
            await expect_config(omni, 'translate_service_list', ['google@default', 'bing@default'])
            await expect.poll(async () => await translate.result_card_keys()).toEqual(['google@default', 'bing@default'])
        } finally {
            await omni.stop()
        }
    })
})
