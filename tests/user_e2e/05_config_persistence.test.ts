import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { init, cleanup, readConfig, writeConfig, getTranslateClient } from './test_utils'
import { ensureBuilt, startElectron, stopElectron, type ElectronInstance } from './electron_launcher'

describe('Critical Path 5: 配置持久化全流程', () => {
    let instance: ElectronInstance
    let originalCloseOnBlur: unknown

    beforeAll(async () => {
        await ensureBuilt()
        instance = await startElectron()
        init(instance.translateClient, instance.httpPort)
        originalCloseOnBlur = await readConfig('translate_close_on_blur')
    }, 60000)

    afterAll(async () => {
        if (originalCloseOnBlur !== undefined) {
            await writeConfig('translate_close_on_blur', originalCloseOnBlur)
        }
        cleanup()
        await stopElectron(instance)
    })

    it('reads default config values via electronAPI', async () => {
        const sourceLang = await readConfig('translate_source_language')
        expect(sourceLang).toBe('auto')

        const targetLang = await readConfig('translate_target_language')
        expect(typeof targetLang).toBe('string')
        expect(targetLang.length).toBeGreaterThan(0)
    })

    it('writes a config value and reads it back in the same session', async () => {
        await writeConfig('translate_close_on_blur', true)

        const value = await readConfig('translate_close_on_blur')
        expect(value).toBe(true)
    })

    it('writes a different value and verifies change', async () => {
        await writeConfig('translate_close_on_blur', false)

        const value = await readConfig('translate_close_on_blur')
        expect(value).toBe(false)
    })

    it('reads all config and verifies structure', async () => {
        const client = await getTranslateClient()
        const allConfig = await client.evaluate(`
            window.electronAPI.config.getAll()
        `) as Record<string, unknown>

        // Verify essential keys exist
        expect(allConfig).toHaveProperty('app_language')
        expect(allConfig).toHaveProperty('translate_source_language')
        expect(allConfig).toHaveProperty('translate_target_language')
        expect(allConfig).toHaveProperty('translate_service_list')
        expect(allConfig).toHaveProperty('server_port')

        // translate_service_list should be an array
        expect(Array.isArray(allConfig.translate_service_list)).toBe(true)
    })

    it('config change broadcasts to renderer', async () => {
        const client = await getTranslateClient()

        // Set up listener before changing
        const receivedKey = await client.evaluate(`
            new Promise((resolve) => {
                const unsub = window.electronAPI.config.onChange((key, value) => {
                    if (key === 'translate_always_on_top') {
                        unsub()
                        resolve(value)
                    }
                })
                // Trigger change
                window.electronAPI.config.set('translate_always_on_top', true)
            })
        `) as boolean

        expect(receivedKey).toBe(true)

        // Restore
        await writeConfig('translate_always_on_top', false)
    }, 10000)

    it('translate_service_list contains default service instances', async () => {
        const serviceList = await readConfig('translate_service_list') as string[]
        expect(serviceList.length).toBeGreaterThan(0)

        // Default instances should include bing and google
        const keys = serviceList.map(k => k.split('@')[0])
        expect(keys).toContain('bing')
        expect(keys).toContain('google')
    })

    it('server_port has valid value', async () => {
        const port = await readConfig('server_port') as number
        expect(port).toBeGreaterThan(0)
        expect(port).toBeLessThanOrEqual(65535)
    })

    it('can read and write numeric config values', async () => {
        const originalSize = await readConfig('app_font_size') as number
        expect(typeof originalSize).toBe('number')

        await writeConfig('app_font_size', 20)
        const newSize = await readConfig('app_font_size') as number
        expect(newSize).toBe(20)

        // Restore
        await writeConfig('app_font_size', originalSize)
        const restored = await readConfig('app_font_size') as number
        expect(restored).toBe(originalSize)
    })

    it('can read and write string config values', async () => {
        const originalLang = await readConfig('app_language') as string

        await writeConfig('app_language', 'zh_cn')
        const newLang = await readConfig('app_language') as string
        expect(newLang).toBe('zh_cn')

        // Restore
        await writeConfig('app_language', originalLang)
        const restored = await readConfig('app_language') as string
        expect(restored).toBe(originalLang)
    })
})
