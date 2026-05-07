export type SelectionMethod = 'uia' | 'accessibility' | 'clipboard' | 'none'

export type SelectionFailureReason =
    | 'empty'
    | 'permission-denied'
    | 'unsupported-platform'
    | 'copy-failed'
    | 'error'

export interface SelectedTextResult {
    text: string
    method: SelectionMethod
    reason?: SelectionFailureReason
    error?: unknown
}

export async function readSelectedText(): Promise<SelectedTextResult> {
    try {
        if (process.platform === 'win32') {
            const { readSelectedTextWindows } = await import('./windows')
            return await readSelectedTextWindows()
        }

        if (process.platform === 'darwin') {
            const { readSelectedTextDarwin } = await import('./darwin')
            return await readSelectedTextDarwin()
        }

        return { text: '', method: 'none', reason: 'unsupported-platform' }
    } catch (error: unknown) {
        return { text: '', method: 'none', reason: 'error', error }
    }
}

export async function getSelectedText(): Promise<string> {
    return (await readSelectedText()).text
}
