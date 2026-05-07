import type { SelectedTextResult } from './index'

export async function readSelectedTextDarwin(): Promise<SelectedTextResult> {
    return { text: '', method: 'none', reason: 'unsupported-platform' }
}
