import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { DEFAULT_CONFIG } from '../../shared/types/config'

// @electron-mock Required: Vitest is not a real Electron runtime.
// This mock stubs app.getLocale / app.getPath / BrowserWindow.getAllWindows so
// the config store can run in Node. Real Electron config persistence and
// broadcast are covered by E2E (config_settings.spec.ts, config_history_backup.spec.ts).
const electron_mock = vi.hoisted(() => ({
    locale: 'en-US',
    user_data_dir: '',
}))

vi.mock('electron', () => ({
    app: {
        getLocale: vi.fn(() => electron_mock.locale),
        getPath: vi.fn(() => electron_mock.user_data_dir),
    },
    BrowserWindow: {
        getAllWindows: vi.fn(() => []),
    },
}))

describe('Config Store integration', () => {
    let test_dir = ''

    beforeEach(() => {
        test_dir = join(tmpdir(), `omni-pot-config-${String(Date.now())}-${String(Math.random())}`)
        electron_mock.user_data_dir = test_dir
        electron_mock.locale = 'en-US'
        process.env['OMNI_POT_USER_DATA'] = test_dir
        mkdirSync(test_dir, { recursive: true })
        vi.resetModules()
    })

    afterEach(async () => {
        const store = await import('../../electron/config/store')
        store.cancel_pending_config_save()
        delete process.env['OMNI_POT_USER_DATA']
        delete process.env['OMNI_POT_PRESET_CONFIG']
        delete process.env['OMNI_POT_FIRST_RUN']
        rmSync(test_dir, { recursive: true, force: true })
        vi.resetModules()
    })

    it('initializes first-run config from system language and persists completion', async () => {
        electron_mock.locale = 'zh-CN'
        const store = await import('../../electron/config/store')

        store.initConfigStore()

        expect(store.isFirstRun()).toBe(true)
        expect(store.getConfig('app_language')).toBe('zh_cn')
        expect(store.getConfig('translate_target_language')).toBe('zh_cn')

        store.commitFirstRun()
        store.flush_config()

        const persisted = JSON.parse(readFileSync(join(test_dir, 'config.json'), 'utf-8')) as Record<string, unknown>
        expect(persisted.__initialized).toBe(true)
        expect(store.isFirstRun()).toBe(false)
    })

    it('uses defaults when stored config is corrupted', async () => {
        writeFileSync(join(test_dir, 'config.json'), 'not valid json {{{')
        const store = await import('../../electron/config/store')

        store.initConfigStore()

        expect(store.getConfig('app_theme')).toBe(DEFAULT_CONFIG.app_theme)
        expect(store.getConfig('translate_source_language')).toBe(DEFAULT_CONFIG.translate_source_language)
        expect(existsSync(join(test_dir, 'config.json'))).toBe(true)
    })

    it('merges stored user config over defaults and sanitizes invalid primary colors', async () => {
        writeFileSync(join(test_dir, 'config.json'), JSON.stringify({
            __initialized: true,
            app_language: 'zh_cn',
            app_theme: 'dark',
            app_primary_color: 'invalid-color',
        }))
        const store = await import('../../electron/config/store')

        store.initConfigStore()
        store.flush_config()

        expect(store.getConfig('app_language')).toBe('zh_cn')
        expect(store.getConfig('app_theme')).toBe('dark')
        expect(store.getConfig('app_primary_color')).toBe(DEFAULT_CONFIG.app_primary_color)
    })

    it('migrates old factory default translate_service_list to new free defaults', async () => {
        writeFileSync(join(test_dir, 'config.json'), JSON.stringify({
            __initialized: true,
            translate_service_list: ['bing@default', 'google@default', 'deepl@default'],
        }))
        const store = await import('../../electron/config/store')

        store.initConfigStore()
        store.flush_config()

        expect(store.getConfig('translate_service_list'))
            .toEqual(DEFAULT_CONFIG.translate_service_list)
    })

    it('preserves user-customized translate_service_list across init', async () => {
        const custom_list = ['bing@default', 'google@default']
        writeFileSync(join(test_dir, 'config.json'), JSON.stringify({
            __initialized: true,
            translate_service_list: custom_list,
        }))
        const store = await import('../../electron/config/store')

        store.initConfigStore()
        store.flush_config()

        expect(store.getConfig('translate_service_list')).toEqual(custom_list)
    })
})
