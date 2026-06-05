import { BrowserWindow, type IpcMainInvokeEvent, type WebContents } from 'electron'
import type { WindowManager } from '../windows/manager'
import type { WindowLabel } from '../windows/types'

export function get_sender_label(manager: Pick<WindowManager, 'getLabelById'>, sender: WebContents): WindowLabel | undefined {
    const win = BrowserWindow.fromWebContents(sender)
    if (!win) return undefined
    return manager.getLabelById(win.id)
}

export function assert_sender_label(
    manager: Pick<WindowManager, 'getLabelById'>,
    event: IpcMainInvokeEvent,
    allowed_labels: readonly WindowLabel[],
    channel: string,
): WindowLabel {
    const label = get_sender_label(manager, event.sender)
    if (!label || !allowed_labels.includes(label)) {
        throw new Error(`Unauthorized IPC sender for ${channel}`)
    }
    return label
}
