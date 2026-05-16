import { test, expect } from '../fixtures/test'
import { AppFixture } from '../fixtures/app_fixture'

const free_service_list = [
    'bing@default',
    'google@default',
    'deepl@default',
    'mymemory@default',
    'lingva@default',
]

const free_service_instances = {
    'bing@default': { serviceKey: 'bing', config: {} },
    'google@default': { serviceKey: 'google', config: {} },
    'deepl@default': { serviceKey: 'deepl', config: { type: 'deeplx_free' } },
    'mymemory@default': { serviceKey: 'mymemory', config: {} },
    'lingva@default': { serviceKey: 'lingva', config: {} },
}

test.describe('@core translate core', () => {
    test.describe.configure({ retries: 2 })

    test('selection translate action fills source text and shows a real result body', async ({ omni }) => {
        const translate = await omni.translate()
        const result = await omni.api.triggerSelection('hello world')

        expect(result.success).toBe(true)
        await expect(translate.sourceInput()).toHaveValue('hello world', { timeout: 10_000 })
        await expect.poll(async () => await translate.resultBodies().count(), { timeout: 45_000 }).toBeGreaterThan(0)
        await expect.poll(async () => {
            const bodies = translate.resultBodies()
            for (let i = 0; i < await bodies.count(); i += 1) {
                const text = await bodies.nth(i).textContent()
                if (text?.trim()) return true
            }
            return false
        }, { timeout: 45_000 }).toBe(true)
    })

    test('clipboard translate action fills source text and shows a real result body', async ({ omni }) => {
        const translate = await omni.translate()
        const result = await omni.api.triggerClipboardTranslate('good morning')

        expect(result.success).toBe(true)
        await expect(translate.sourceInput()).toHaveValue('good morning', { timeout: 10_000 })
        await expect.poll(async () => await translate.resultBodies().count(), { timeout: 45_000 }).toBeGreaterThan(0)
        await expect.poll(async () => {
            const bodies = translate.resultBodies()
            for (let i = 0; i < await bodies.count(); i += 1) {
                const text = await bodies.nth(i).textContent()
                if (text?.trim()) return true
            }
            return false
        }, { timeout: 45_000 }).toBe(true)
    })

    test('all free translation services return visible user results', async () => {
        const omni = await AppFixture.start({
            config: {
                translate_service_list: free_service_list,
                service_instances: free_service_instances,
            },
        })

        try {
            const translate = await omni.translate()
            await translate.fulfill_lingva_translation_once('Lingva mocked result')
            await translate.fulfill_mymemory_translation_once('MyMemory mocked result')
            await translate.typeSource('hello world')
            await translate.clickTranslate()

            await translate.waitForResultCount(free_service_list.length, 60_000)
            await translate.waitAllResults(60_000)

            for (const instanceKey of free_service_list) {
                await expect(translate.resultCard(instanceKey)).toBeVisible()
                await expect(translate.resultCard(instanceKey).getByTestId('result-error')).toHaveCount(0)
                await expect.poll(async () => {
                    const text = await translate.getResultText(instanceKey)
                    return text?.trim() ?? ''
                }, { timeout: 60_000 }).not.toBe('')
            }
        } finally {
            await omni.stop()
        }
    })
})
