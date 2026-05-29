import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'
import type { TranslationTestServer } from '../fixtures/translation_test_server'

const SERVICE_CATEGORIES = [
    ['translate_service_list', '翻译', ['Bing', 'DeepL', 'MyMemory']],
    ['dictionary_service_list', 'Chinese Dictionary', ['Chinese Dictionary', 'CC-CEDICT']],
    ['english_dictionary_service_list', '英文词典', ['Cambridge Dict', 'CC-CEDICT']],
    ['recognize_service_list', '识别', ['Tesseract', 'System OCR', 'QR Code']],
    ['tts_service_list', '朗读', ['System TTS']],
] as const

type ServiceInstanceConfig = {
    serviceKey: string
    config: Record<string, unknown>
}

async function expect_service_config(omni: AppFixture, instance_key: string, value: Record<string, unknown>): Promise<void> {
    await expect.poll(async () => {
        const instances = (await omni.api.getConfig()).service_instances as Record<string, ServiceInstanceConfig>
        return instances[instance_key].config
    }).toEqual(value)
}

async function expect_service_config_match(omni: AppFixture, instance_key: string, value: Record<string, unknown>): Promise<void> {
    await expect.poll(async () => {
        const instances = (await omni.api.getConfig()).service_instances as Record<string, ServiceInstanceConfig>
        return instances[instance_key].config
    }).toMatchObject(value)
}

test.describe('@ui config service management', () => {
    test('user switches service categories and sees enabled service lists', async () => {
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()
            await config.openSection('service')

            await expect(config.title()).toContainText('服务')
            await expect(config.addServiceButton()).toBeVisible()

            for (const [category, label, service_names] of SERVICE_CATEGORIES) {
                await config.openServiceCategory(category)
                await expect(config.serviceTab(category)).toHaveAttribute('aria-selected', 'true')
                await expect(config.serviceTab(category)).toContainText(label)
                await expect(config.serviceTab(category)).toContainText(String(service_names.length))
                await expect(config.serviceItems()).toHaveCount(service_names.length)
                for (const service_name of service_names) {
                    await expect(config.serviceItems().filter({ hasText: service_name })).toBeVisible()
                }
            }

            await config.openServiceCategory('translate_service_list')
            await expect(config.serviceItem('bing@default')).toContainText('Bing')
            // Spec §9.7: 实例 key 副文本已移除，不在 UI 中显示
            await expect(config.serviceItem('bing@default')).not.toContainText('bing@default')
            await expect(config.serviceDragHandle('bing@default')).toBeVisible()
            await expect(config.serviceToggle('bing@default')).toHaveAttribute('aria-checked', 'true')
            await expect(config.serviceEdit('bing@default')).toBeVisible()
            await expect(config.serviceMoveControls('bing@default')).toHaveCount(2)
            await expect(config.serviceDelete('bing@default')).toBeEnabled()
        } finally {
            await omni.stop()
        }
    })

    test('tab counts stay independent when switching categories', async () => {
        // Regression guard: the service page tabs each used to render `{serviceList.length}`,
        // which is the *currently selected* tab's list — switching tabs caused all
        // counts to show the same number. Each tab must report its own enabled count
        // regardless of which one is active.
        const omni = await AppFixture.start({ config: { app_language: 'zh_cn' } })

        try {
            const config = await omni.openConfig()
            await config.openSection('service')

            const expected_counts: Record<string, number> = {}
            for (const [category, , service_names] of SERVICE_CATEGORIES) {
                expected_counts[category] = service_names.length
            }

            // Visit each tab and record what every other tab reports.
            for (const [active, ,] of SERVICE_CATEGORIES) {
                await config.openServiceCategory(active)
                for (const [other, ,] of SERVICE_CATEGORIES) {
                    await expect(
                        config.serviceTab(other),
                        `tab ${other} should show ${String(expected_counts[other])} while ${active} is active`
                    ).toContainText(String(expected_counts[other]))
                }
            }
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

            await expect(config.serviceItems()).toHaveCount(1)
            await expect(config.serviceItems().first()).toContainText('Bing')
            await config.addService('google')

            let google_key = ''
            await expect.poll(async () => {
                const service_list = (await omni.api.getConfig()).translate_service_list as string[]
                google_key = service_list.find((key) => key.startsWith('google@')) ?? ''
                return !!google_key
            }).toBe(true)
            await expect(config.serviceItem(google_key)).toContainText('Google')
            await expect(config.serviceItems()).toHaveCount(2)

            await config.deleteService(google_key)

            await expect(config.serviceItems()).toHaveCount(1)
            await expect(config.serviceItems().first()).toContainText('Bing')
            await expect(config.serviceItems().filter({ hasText: 'Google' })).toHaveCount(0)
        } finally {
            await omni.stop()
        }
    })

    test('user disables and re-enables a translation service and result cards follow enabled state', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                translate_pinned: true,
                translate_service_list: ['mymemory@first', 'mymemory@second'],
                service_instances: {
                    'mymemory@first': { serviceKey: 'mymemory', config: {} },
                    'mymemory@second': { serviceKey: 'mymemory', config: {} },
                },
            },
        })

        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer(['mymemory@first', 'mymemory@second'])
            server.set_mymemory_response({ translated_text: '你好', status: 200 }, 'mymemory@first')
            server.set_mymemory_response({ translated_text: '你好', status: 200 }, 'mymemory@second')
            const translate = await omni.translate()
            await translate.typeSource('hello')
            await translate.clickTranslate()
            const config = await omni.openConfig()
            await config.openSection('service')
            await config.openServiceCategory('translate_service_list')

            await expect(translate.resultCards()).toHaveCount(2)
            await expect(translate.resultCards().nth(0)).toContainText('MyMemory')
            await expect(translate.resultCards().nth(1)).toContainText('MyMemory')
            await expect.poll(() => config.serviceItemKeys()).toEqual(['mymemory@first', 'mymemory@second'])
            const original_service_list = await config.serviceItemKeys()
            await config.toggleService('mymemory@first')

            await expect(config.serviceToggle('mymemory@first')).toHaveAttribute('aria-checked', 'false')
            await expect(config.serviceItems()).toHaveCount(2)
            await expect(config.serviceItem('mymemory@first')).toContainText('MyMemory')
            await expect(config.serviceItem('mymemory@second')).toContainText('MyMemory')
            expect(await config.serviceItemKeys()).toEqual(original_service_list)
            await expect.poll(async () => (await omni.api.getConfig()).translate_service_list).toEqual(original_service_list)
            await expect_service_config_match(omni, 'mymemory@first', { enable: false })
            await expect(translate.resultCards()).toHaveCount(1)
            await expect(translate.resultCards().first()).toContainText('MyMemory')

            await config.toggleService('mymemory@first')

            await expect(config.serviceToggle('mymemory@first')).toHaveAttribute('aria-checked', 'true')
            await expect(config.serviceItems()).toHaveCount(2)
            expect(await config.serviceItemKeys()).toEqual(original_service_list)
            await expect.poll(async () => (await omni.api.getConfig()).translate_service_list).toEqual(original_service_list)
            await expect_service_config_match(omni, 'mymemory@first', { enable: true })
            await expect(translate.resultCards()).toHaveCount(2)
            await expect(translate.resultCards().nth(0)).toContainText('MyMemory')
            await expect(translate.resultCards().nth(1)).toContainText('MyMemory')
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })

    test('user edits tests and saves a translation service instance config', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                translate_service_list: ['mymemory@default'],
                service_instances: {
                    'mymemory@default': { serviceKey: 'mymemory', config: {} },
                },
            },
        })

        try {
            const config = await omni.openConfig()
            await config.openSection('service')
            await config.openServiceCategory('translate_service_list')

            await config.openServiceEditor('mymemory@default')
            await expect(config.serviceEditModal()).toBeVisible()
            await config.fillServiceEditor('MyMemory E2E', '{}')
            await config.fulfillMymemoryTestOnce()
            await config.testServiceConfig()
            await expect(config.serviceTestStatus()).toContainText('测试成功')
            await config.saveServiceConfig()

            await expect(config.serviceEditModal()).toHaveCount(0)
            await expect(config.serviceItem('mymemory@default')).toContainText('MyMemory E2E')
            await expect_service_config(omni, 'mymemory@default', {
                instanceName: 'MyMemory E2E',
            })
        } finally {
            await omni.stop()
        }
    })

    test('user drags translation services and sees result cards follow the order', async () => {
        const omni = await AppFixture.start({
            config: {
                app_language: 'zh_cn',
                translate_pinned: true,
                translate_service_list: ['mymemory@first', 'mymemory@second'],
                service_instances: {
                    'mymemory@first': { serviceKey: 'mymemory', config: {} },
                    'mymemory@second': { serviceKey: 'mymemory', config: {} },
                },
            },
        })

        let server: TranslationTestServer | null = null
        try {
            server = await omni.startTranslationTestServer(['mymemory@first', 'mymemory@second'])
            server.set_mymemory_response({ translated_text: '你好', status: 200 }, 'mymemory@first')
            server.set_mymemory_response({ translated_text: '你好', status: 200 }, 'mymemory@second')
            const translate = await omni.translate()
            await translate.typeSource('hello')
            await translate.clickTranslate()
            const config = await omni.openConfig()
            await config.openSection('service')
            await config.openServiceCategory('translate_service_list')

            await expect(config.serviceItems()).toHaveCount(2)
            await expect(config.serviceItems().nth(0)).toContainText('MyMemory')
            await expect(config.serviceItems().nth(1)).toContainText('MyMemory')
            await expect(translate.resultCards()).toHaveCount(2)
            await expect(translate.resultCards().nth(0)).toHaveAttribute('data-result-key', 'mymemory@first')
            await expect(translate.resultCards().nth(1)).toHaveAttribute('data-result-key', 'mymemory@second')

            await config.dragService('mymemory@first', 'mymemory@second')

            await expect(config.serviceItems().nth(0)).toContainText('MyMemory')
            await expect(config.serviceItems().nth(1)).toContainText('MyMemory')
            await expect(translate.resultCards().nth(0)).toHaveAttribute('data-result-key', 'mymemory@second')
            await expect(translate.resultCards().nth(1)).toHaveAttribute('data-result-key', 'mymemory@first')
        } finally {
            await server?.stop()
            await omni.stop()
        }
    })
})
