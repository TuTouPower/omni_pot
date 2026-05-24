import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
    it('removes ecdict from existing dictionary config and restores current dictionary defaults', async () => {
        const user_data_dir = mkdtempSync(join(tmpdir(), 'omni-pot-config-'))
        process.env['OMNI_POT_USER_DATA'] = user_data_dir
        writeFileSync(join(user_data_dir, 'config.json'), JSON.stringify({
            __initialized: true,
            dictionary_service_list: ['ecdict@default'],
            english_dictionary_service_list: ['ecdict@default'],
            service_instances: {
                'ecdict@default': { serviceKey: 'ecdict', config: {} },
            },
        }), 'utf-8')

        const store = await import('../../electron/config/store')
        store.initConfigStore()
        const config = store.getAllConfig()

        expect(config.dictionary_service_list).toEqual(['chinese_dictionary@default'])
        expect(config.english_dictionary_service_list).toEqual(['cambridge_dict@default'])
        expect(config.service_instances['ecdict@default']).toBeUndefined()
        expect(config.service_instances['chinese_dictionary@default'].serviceKey).toBe('chinese_dictionary')
        expect(config.service_instances['cambridge_dict@default'].serviceKey).toBe('cambridge_dict')
    })
})
