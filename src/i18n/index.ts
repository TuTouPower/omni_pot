import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import { useConfigStore } from '../stores/config_store'

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en }
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
}).catch(console.error)

const loaded_locales = new Set<string>(['en'])

async function load_locale(lang: string): Promise<Record<string, unknown>> {
    const mod = await import(`./locales/${lang}.json`)
    return mod.default as Record<string, unknown>
}

async function ensure_locale(lang: string): Promise<void> {
    if (loaded_locales.has(lang)) return
    try {
        const bundle = await load_locale(lang)
        i18n.addResourceBundle(lang, 'translation', bundle)
        loaded_locales.add(lang)
    } catch {
        // keep silent; i18next falls back to 'en'
    }
}

export async function bindI18nToConfig(): Promise<void> {
    const apply = async (lang: string): Promise<void> => {
        await ensure_locale(lang)
        if (i18n.language !== lang) {
            await i18n.changeLanguage(lang)
        }
    }
    await apply(useConfigStore.getState().config.app_language)
    useConfigStore.subscribe((state, prev) => {
        if (state.config.app_language !== prev.config.app_language) {
            apply(state.config.app_language).catch(console.error)
        }
    })
}

export default i18n
