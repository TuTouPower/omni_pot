import { ipcMain } from 'electron'
import { detect_local_cld3 } from '../detect'
import type { LanguageCode } from '@shared/types/language'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { assert_sender_label } from './sender_validation'

const detect_labels = [WindowLabel.TRANSLATE, WindowLabel.DICT, WindowLabel.RECOGNIZE] as const

export function registerDetectHandlers(manager: WindowManager): void {
    ipcMain.handle('detect:local', (event, text: string): { lang: LanguageCode; source: 'cld3' | 'regex' } => {
        assert_sender_label(manager, event, detect_labels, 'detect:local')
        if (!text || text.trim().length === 0) {
            return { lang: 'en', source: 'regex' }
        }

        return detect_local_cld3(text)
    })
}
