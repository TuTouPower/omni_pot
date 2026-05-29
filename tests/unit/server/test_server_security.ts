import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '@shared/types/config'
import type { AppConfig } from '@shared/types/config'

vi.mock('electron', () => ({
    app: {
        getVersion: vi.fn(() => '0.0.0'),
    },
    clipboard: {
        readText: vi.fn(() => ''),
        writeText: vi.fn(),
        readImage: vi.fn(() => ({
            getSize: vi.fn(() => ({ width: 0, height: 0 })),
            isEmpty: vi.fn(() => true),
        })),
    },
    desktopCapturer: {
        getSources: vi.fn(() => Promise.resolve([])),
    },
    globalShortcut: {
        isRegistered: vi.fn(() => false),
        register: vi.fn(() => true),
        unregister: vi.fn(),
        unregisterAll: vi.fn(),
    },
    ipcMain: {
        handle: vi.fn(),
        removeHandler: vi.fn(),
    },
    screen: {
        getPrimaryDisplay: vi.fn(() => ({
            bounds: { width: 1920, height: 1080 },
            scaleFactor: 1,
            workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        })),
    },
}))

vi.mock('../../../electron/config/store', () => ({
    getConfig: vi.fn(() => 20202),
    getAllConfig: vi.fn(() => DEFAULT_CONFIG),
    setConfig: vi.fn(),
    resetConfigToDefaults: vi.fn(),
}))

describe('server security helpers', () => {
    it('allows only exact localhost hosts with optional port', async () => {
        const { is_host_allowed } = await import('../../../electron/server')

        expect(is_host_allowed('localhost')).toBe(true)
        expect(is_host_allowed('localhost:20202')).toBe(true)
        expect(is_host_allowed('127.0.0.1')).toBe(true)
        expect(is_host_allowed('127.0.0.1:20202')).toBe(true)

        expect(is_host_allowed('localhost:5173')).toBe(true)
        expect(is_host_allowed('127.0.0.1:65535')).toBe(true)
        expect(is_host_allowed('localhost.evil.com:20202')).toBe(false)
        expect(is_host_allowed('127.0.0.1.evil.com')).toBe(false)
        expect(is_host_allowed('evil.com')).toBe(false)
        expect(is_host_allowed('')).toBe(false)
    })

    it('allows only localhost origins with optional port', async () => {
        const { is_origin_allowed, should_reject_origin } = await import('../../../electron/server')

        expect(is_origin_allowed('http://localhost')).toBe(true)
        expect(is_origin_allowed('http://127.0.0.1')).toBe(true)
        expect(is_origin_allowed('https://localhost')).toBe(true)
        expect(is_origin_allowed('https://127.0.0.1')).toBe(true)
        expect(is_origin_allowed('http://localhost:5173')).toBe(true)
        expect(is_origin_allowed('https://127.0.0.1:5173')).toBe(true)
        expect(is_origin_allowed('http://localhost:80')).toBe(true)
        expect(is_origin_allowed('https://localhost:443')).toBe(true)

        expect(is_origin_allowed('http://localhost.evil.com')).toBe(false)
        expect(is_origin_allowed('http://evil.com')).toBe(false)
        expect(is_origin_allowed('')).toBe(false)
        expect(should_reject_origin('http://evil.com')).toBe(true)
        expect(should_reject_origin('http://localhost.evil.com')).toBe(true)
        expect(should_reject_origin('http://localhost:5173')).toBe(false)
        expect(should_reject_origin('')).toBe(false)
    })

    it('redacts public config secrets while keeping allowed service keys', async () => {
        const { get_public_config_from_config } = await import('../../../electron/server')
        const config: AppConfig = {
            ...DEFAULT_CONFIG,
            webdav_url: 'https://webdav.example.com/dav',
            webdav_username: 'user',
            webdav_password: 'password',
            service_instances: {
                'secret@default': {
                    serviceKey: 'secret',
                    config: {
                        enable: true,
                        instanceName: 'Secret Service',
                        apiKey: 'api-key',
                        endpoint: 'https://api.example.com',
                    },
                },
            },
        }

        const public_config = get_public_config_from_config(config)
        const public_instance = public_config.service_instances['secret@default']

        expect(public_config.webdav_url).toBe('[redacted]')
        expect(public_config.webdav_username).toBe('[redacted]')
        expect(public_config.webdav_password).toBe('[redacted]')
        expect(public_instance.serviceKey).toBe('secret')
        expect(public_instance.config).toEqual({
            enable: true,
            instanceName: 'Secret Service',
        })
        expect(public_instance.config).not.toHaveProperty('apiKey')
        expect(public_instance.config).not.toHaveProperty('endpoint')
    })
})
