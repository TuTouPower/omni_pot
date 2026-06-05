import type { SelectedTextResult } from './index'

export function readSelectedTextDarwin(): Promise<SelectedTextResult> {
    return Promise.resolve({ text: '', method: 'none', reason: 'unsupported-platform' })
}
