import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT_DIR = join(__dirname, '..', '..')
const LOCALES_DIR = join(ROOT_DIR, 'src', 'i18n', 'locales')

describe('locale copy', () => {
    it('does not keep empty selection hotkey notice copy in any locale', () => {
        for (const file of readdirSync(LOCALES_DIR).filter((name) => name.endsWith('.json'))) {
            const locale = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8')) as unknown
            const selection = (locale as { selection?: Record<string, unknown> }).selection ?? {}

            expect(selection, file).not.toHaveProperty('no_text')
            expect(JSON.stringify(locale), file).not.toContain('未读取到选中的文本')
            expect(JSON.stringify(locale), file).not.toContain('No selected text was found')
        }
    })
})
