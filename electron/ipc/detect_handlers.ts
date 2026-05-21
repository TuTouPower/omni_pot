import { ipcMain } from 'electron'
import { detect_local_cld3 } from '../detect'
import type { LanguageCode } from '@shared/types/language'

export function registerDetectHandlers(): void {
    ipcMain.handle('detect:local', (_event, text: string): { lang: LanguageCode; source: 'cld3' | 'regex' } => {
        if (!text || text.trim().length === 0) {
            return { lang: 'en', source: 'regex' }
        }

        return detect_local_cld3(text)
    })
}
