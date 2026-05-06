import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zhCn from './locales/zh_cn.json'
import { useConfigStore } from '../stores/config_store'

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        zh_cn: { translation: zhCn }
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
})

export function bindI18nToConfig(): void {
    const apply = (lang: string): void => {
        if (i18n.language !== lang) void i18n.changeLanguage(lang)
    }
    apply(useConfigStore.getState().config.app_language)
    useConfigStore.subscribe((state, prev) => {
        if (state.config.app_language !== prev.config.app_language) {
            apply(state.config.app_language)
        }
    })
}

export default i18n
