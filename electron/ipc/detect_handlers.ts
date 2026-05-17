import { ipcMain } from 'electron'
import { detect_local_cld3, detect_regex } from '../detect'
import { getConfig } from '../config/store'
import type { LanguageCode } from '@shared/types/language'

export function registerDetectHandlers(): void {
    ipcMain.handle('detect:local', (_event, text: string): { lang: LanguageCode; source: 'cld3' | 'regex' } => {
        if (!text || text.trim().length === 0) {
            return { lang: 'en', source: 'regex' }
        }

        const cld3_enabled = getConfig('detect_cld3_enabled')
        if (cld3_enabled === false) {
            return { lang: detect_regex(text), source: 'regex' }
        }

        return detect_local_cld3(text)
    })
}
