import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

describe('readSelectedText platform dispatch', () => {
    const original_platform = process.platform

    beforeEach(() => {
        vi.resetModules()
    })

    afterAll(() => {
        Object.defineProperty(process, 'platform', {
            value: original_platform,
            configurable: true,
        })
    })

    it('returns unsupported-platform on linux', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
        const { readSelectedText } = await import('../../../electron/selection/index')
        const result = await readSelectedText()
        expect(result.method).toBe('none')
        expect(result.reason).toBe('unsupported-platform')
        expect(result.text).toBe('')
    })

    it('getSelectedText returns only the text string on unsupported platform', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
        const { getSelectedText } = await import('../../../electron/selection/index')
        const text = await getSelectedText()
        expect(text).toBe('')
    })

    it('dispatches to windows module on win32', async () => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
        const fake_result = { text: 'hello from windows', method: 'uia' as const }
        const windows_fn = vi.fn().mockResolvedValue(fake_result)
        vi.doMock('../../../electron/selection/windows', () => ({
            readSelectedTextWindows: windows_fn,
        }))

        const { readSelectedText } = await import('../../../electron/selection/index')
        const result = await readSelectedText()

        expect(windows_fn).toHaveBeenCalledOnce()
        expect(result.text).toBe('hello from windows')
        expect(result.method).toBe('uia')
    })

    it('dispatches to darwin module on darwin', async () => {
        Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
        const fake_result = { text: 'hello from mac', method: 'accessibility' as const }
        const darwin_fn = vi.fn().mockResolvedValue(fake_result)
        vi.doMock('../../../electron/selection/darwin', () => ({
            readSelectedTextDarwin: darwin_fn,
        }))

        const { readSelectedText } = await import('../../../electron/selection/index')
        const result = await readSelectedText()

        expect(darwin_fn).toHaveBeenCalledOnce()
        expect(result.text).toBe('hello from mac')
        expect(result.method).toBe('accessibility')
    })

    it('prepared windows reader starts before the first await', async () => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
        const events: string[] = []
        const windows_fn = vi.fn(() => {
            events.push('windows')
            return new Promise(() => {})
        })
        vi.doMock('../../../electron/selection/windows', () => ({
            readSelectedTextWindows: windows_fn,
        }))

        const { prepareSelectedTextReader, readSelectedText } = await import('../../../electron/selection/index')
        await prepareSelectedTextReader()

        readSelectedText().catch(() => undefined)
        events.push('after-call')

        expect(events).toEqual(['windows', 'after-call'])
    })

    it('prepare failure does not throw or prevent later error result', async () => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
        vi.doMock('../../../electron/selection/windows', () => {
            throw new Error('native preload failed')
        })

        const { prepareSelectedTextReader, readSelectedText } = await import('../../../electron/selection/index')
        await expect(prepareSelectedTextReader()).resolves.toBeUndefined()

        const result = await readSelectedText()
        expect(result.method).toBe('none')
        expect(result.reason).toBe('error')
        expect(result.text).toBe('')
        expect(result.error).toBeInstanceOf(Error)
    })

    it('catches platform module error and returns error result', async () => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
        vi.doMock('../../../electron/selection/windows', () => ({
            readSelectedTextWindows: () => Promise.reject(new Error('koffi DLL explosion')),
        }))

        const { readSelectedText } = await import('../../../electron/selection/index')
        const result = await readSelectedText()

        expect(result.method).toBe('none')
        expect(result.reason).toBe('error')
        expect(result.text).toBe('')
        expect(result.error).toBeInstanceOf(Error)
        expect((result.error as Error).message).toBe('koffi DLL explosion')
    })
})
