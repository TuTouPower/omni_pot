import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it, vi } from 'vitest'

// @electron-mock: mocks app.getPath / getLocale to test config store migration without real Electron runtime
vi.mock('electron', () => ({
    app: {
        getPath: () => process.env['OMNI_POT_USER_DATA'] ?? '',
        getLocale: () => 'zh-CN',
    },
    BrowserWindow: {
        getAllWindows: () => [],
    },
}))

afterEach(() => {
    delete process.env['OMNI_POT_USER_DATA']
    delete process.env['OMNI_POT_PRESET_CONFIG']
    delete process.env['OMNI_POT_FIRST_RUN']
    vi.resetModules()
})

describe('config store migrations', () => {
    it('does not force ecdict into user who removed it', async () => {
        const user_data_dir = mkdtempSync(join(tmpdir(), 'omni-pot-config-'))
        process.env['OMNI_POT_USER_DATA'] = user_data_dir
        writeFileSync(join(user_data_dir, 'config.json'), JSON.stringify({
            __initialized: true,
            dictionary_service_list: ['chinese_dictionary@default'],
            english_dictionary_service_list: ['cambridge_dict@default'],
            service_instances: {},
        }), 'utf-8')

        const store = await import('../../src/main/config/store')
        store.initConfigStore()
        const config = store.getAllConfig()

        // Persisted config without ecdict stays without ecdict — user may have removed it intentionally
        expect(config.dictionary_service_list).toEqual(['chinese_dictionary@default'])
        expect(config.english_dictionary_service_list).toEqual(['cambridge_dict@default'])
        // But service_instances still gets defaults merged in (ecdict@default from DEFAULT_SERVICE_INSTANCES)
        expect(config.service_instances['ecdict@default']).toBeDefined()
        expect(config.service_instances['ecdict@default'].serviceKey).toBe('ecdict')
    })
})
