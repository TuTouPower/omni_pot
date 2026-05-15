import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zhCn from './locales/zh_cn.json'
import zhTw from './locales/zh_tw.json'
import ru from './locales/ru.json'
import ptBr from './locales/pt_br.json'
import de from './locales/de.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import ptPt from './locales/pt_pt.json'
import tr from './locales/tr.json'
import nbNo from './locales/nb_no.json'
import nnNo from './locales/nn_no.json'
import fa from './locales/fa.json'
import uk from './locales/uk.json'
import ar from './locales/ar.json'
import he from './locales/he.json'
import { useConfigStore } from '../stores/config_store'

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        zh_cn: { translation: zhCn },
        zh_tw: { translation: zhTw },
        ru: { translation: ru },
        pt_br: { translation: ptBr },
        de: { translation: de },
        es: { translation: es },
        fr: { translation: fr },
        it: { translation: it },
        ja: { translation: ja },
        ko: { translation: ko },
        pt_pt: { translation: ptPt },
        tr: { translation: tr },
        nb_no: { translation: nbNo },
        nn_no: { translation: nnNo },
        fa: { translation: fa },
        uk: { translation: uk },
        ar: { translation: ar },
        he: { translation: he }
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
}).catch(console.error)

export function bindI18nToConfig(): void {
    const apply = (lang: string): void => {
        if (i18n.language !== lang) i18n.changeLanguage(lang).catch(console.error)
    }
    apply(useConfigStore.getState().config.app_language)
    useConfigStore.subscribe((state, prev) => {
        if (state.config.app_language !== prev.config.app_language) {
            apply(state.config.app_language)
        }
    })
}

export default i18n
