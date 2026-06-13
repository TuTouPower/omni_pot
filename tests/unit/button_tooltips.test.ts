import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..', '..')
const LOCALES_DIR = join(REPO_ROOT, 'src', 'i18n', 'locales')

/**
 * Toast i18n keys required by the P13 toast feedback wiring.
 * Source: src/components/toast.tsx + various window handlers calling show_toast(t('toast.xxx')).
 */
const REQUIRED_TOAST_KEYS = [
    'copied',
    'cleared',
    'newline_removed',
    'spaces_removed',
    'image_copied',
    'path_copied',
    'saved',
] as const

function load_locale_bundle(lang: string): Record<string, unknown> | null {
    const path = join(LOCALES_DIR, `${lang}.json`)
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
}

function get_nested(bundle: Record<string, unknown>, dotted: string): unknown {
    return dotted.split('.').reduce<unknown>((acc, key) => {
        if (acc && typeof acc === 'object') {
            return (acc as Record<string, unknown>)[key]
        }
        return undefined
    }, bundle)
}

describe('toast i18n coverage', () => {
    it('en (fallback locale) defines every required toast.* key', () => {
        const en = load_locale_bundle('en')
        if (!en) throw new Error('en.json missing')
        const toast = get_nested(en, 'toast') as Record<string, unknown> | undefined
        expect(toast).toBeDefined()
        for (const key of REQUIRED_TOAST_KEYS) {
            expect(toast?.[key], `en.toast.${key}`).toBeTypeOf('string')
        }
    })

    it('zh_cn defines every required toast.* key (Chinese defaults)', () => {
        const zh_cn = load_locale_bundle('zh_cn')
        if (!zh_cn) throw new Error('zh_cn.json missing')
        const toast = get_nested(zh_cn, 'toast') as Record<string, unknown> | undefined
        expect(toast).toBeDefined()
        for (const key of REQUIRED_TOAST_KEYS) {
            expect(toast?.[key], `zh_cn.toast.${key}`).toBeTypeOf('string')
        }
    })

    it('every locale file is valid JSON and contains a toast.* object or omits it (fallback to en)', () => {
        const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))
        expect(files.length).toBeGreaterThan(0)
        for (const file of files) {
            const lang = file.replace(/\.json$/, '')
            const bundle = load_locale_bundle(lang)
            expect(bundle, `${file} must parse as JSON`).not.toBeNull()
            if (bundle && get_nested(bundle, 'toast') !== undefined) {
                const toast = get_nested(bundle, 'toast')
                expect(toast, `${file} toast must be an object`).toBeTypeOf('object')
            }
        }
    })
})
