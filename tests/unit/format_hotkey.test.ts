import { describe, expect, it } from 'vitest'

describe('format_hotkey', () => {
    it('returns empty array for empty accelerator', async () => {
        const { format_hotkey } = await import('../../src/utils/format_hotkey')
        expect(format_hotkey('')).toEqual([])
    })

    it('parses accelerator with plus separator', async () => {
        const { format_hotkey } = await import('../../src/utils/format_hotkey')
        expect(format_hotkey('Control+Alt+T')).toEqual(['Ctrl', 'Alt', 'T'])
    })

    it('trims whitespace around segments', async () => {
        const { format_hotkey } = await import('../../src/utils/format_hotkey')
        expect(format_hotkey('Control + Alt + T')).toEqual(['Ctrl', 'Alt', 'T'])
    })

    it('filters out empty segments from trailing plus', async () => {
        const { format_hotkey } = await import('../../src/utils/format_hotkey')
        expect(format_hotkey('Control+Alt+')).toEqual(['Ctrl', 'Alt'])
    })

    it('maps CommandOrControl to Ctrl on Windows', async () => {
        const { format_hotkey } = await import('../../src/utils/format_hotkey')
        expect(format_hotkey('CommandOrControl+C')).toContain('Ctrl')
    })

    it('maps Super/Meta to Win on Windows', async () => {
        const { format_hotkey } = await import('../../src/utils/format_hotkey')
        expect(format_hotkey('Super+X')).toContain('Win')
    })

    it('passes through unknown segments unchanged', async () => {
        const { format_hotkey } = await import('../../src/utils/format_hotkey')
        expect(format_hotkey('F5')).toEqual(['F5'])
    })
})
