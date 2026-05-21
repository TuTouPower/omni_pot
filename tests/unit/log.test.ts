import { normalize } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron_mock = vi.hoisted(() => ({
    is_packaged: false,
}))

type FileTransportMock = { resolvePathFn?: () => string; maxSize?: number; level?: string | false }
type ConsoleTransportMock = { level?: string | false }

type LoggerMock = {
    transports: {
        file: FileTransportMock
        console: ConsoleTransportMock
    }
    hooks: Array<(message: { data: unknown[] }) => { data: unknown[] }>
    initialize: ReturnType<typeof vi.fn>
    errorHandler: { startCatching: ReturnType<typeof vi.fn> }
    scope: ReturnType<typeof vi.fn>
}

const logger_mock = vi.hoisted<LoggerMock>(() => ({
    transports: {
        file: {},
        console: {},
    },
    hooks: [] as Array<(message: { data: unknown[] }) => { data: unknown[] }>,
    initialize: vi.fn(),
    errorHandler: { startCatching: vi.fn() },
    scope: vi.fn(),
}))

vi.mock('electron', () => ({
    app: {
        get isPackaged() {
            return electron_mock.is_packaged
        },
    },
}))

vi.mock('electron-log/main', () => ({
    default: logger_mock,
}))

import { getLogDir, initLog, redact_log_value } from '../../electron/log'

describe('log system', () => {
    beforeEach(() => {
        electron_mock.is_packaged = false
        logger_mock.transports.file = {}
        logger_mock.transports.console = {}
        logger_mock.hooks.length = 0
        logger_mock.initialize.mockClear()
        logger_mock.errorHandler.startCatching.mockClear()
    })

    it('configures log path, rotation, and development levels', () => {
        initLog('/tmp/omni-pot-user-data')

        expect(logger_mock.transports.file.resolvePathFn?.()).toBe(normalize('/tmp/omni-pot-user-data/logs/main.log'))
        expect(logger_mock.transports.file.maxSize).toBe(5 * 1024 * 1024)
        expect(logger_mock.transports.file.level).toBe('debug')
        expect(logger_mock.transports.console.level).toBe('debug')
        expect(logger_mock.initialize).toHaveBeenCalledOnce()
        expect(logger_mock.errorHandler.startCatching).toHaveBeenCalledOnce()
    })

    it('disables console logging in packaged builds', () => {
        electron_mock.is_packaged = true

        initLog('/tmp/omni-pot-user-data')

        expect(logger_mock.transports.file.level).toBe('info')
        expect(logger_mock.transports.console.level).toBe(false)
    })

    it('registers one hook that redacts secrets before transport writes', () => {
        initLog('/tmp/omni-pot-user-data')
        initLog('/tmp/omni-pot-user-data')

        expect(logger_mock.hooks).toHaveLength(1)
        expect(logger_mock.hooks[0]({
            data: [{ api_key: 'abcd1234wxyz', nested: { password: 'secret123456' }, name: 'plain' }],
        }).data).toEqual([{ api_key: 'abcd…wxyz', nested: { password: 'secr…3456' }, name: 'plain' }])
    })

    it('returns the userData log directory', () => {
        expect(getLogDir('/tmp/omni-pot-user-data')).toBe(normalize('/tmp/omni-pot-user-data/logs'))
    })

    it('redacts sensitive values recursively without changing public fields', () => {
        const error = new Error('network failed')

        expect(redact_log_value({
            service: 'mymemory',
            config: {
                apiKey: '1234567890abcdef',
                client_secret: 'client-secret-value',
                secret_key: 'secret-key-value',
                accesskey_secret: 'access-secret-value',
                enable: true,
            },
            items: [{ token: 'short' }],
            error,
        })).toEqual({
            service: 'mymemory',
            config: {
                apiKey: '1234…cdef',
                client_secret: 'clie…alue',
                secret_key: 'secr…alue',
                accesskey_secret: 'acce…alue',
                enable: true,
            },
            items: [{ token: '[redacted]' }],
            error,
        })
    })
})
