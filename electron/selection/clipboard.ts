import { clipboard, NativeImage } from 'electron'
import { randomUUID } from 'node:crypto'
import type { SelectedTextResult } from './index'

interface ClipboardBackup {
    text: string
    html: string
    rtf: string
    image: NativeImage | null
    bookmark: { title: string; url: string } | null
    buffers: Map<string, Buffer>
}

function backupClipboard(): ClipboardBackup {
    const formats = clipboard.availableFormats()
    const buffers = new Map<string, Buffer>()
    for (const format of formats) {
        const buf = clipboard.readBuffer(format)
        if (buf.length > 0) {
            buffers.set(format, buf)
        }
    }

    const bookmark = clipboard.readBookmark()
    const image = clipboard.readImage()

    return {
        text: clipboard.readText(),
        html: clipboard.readHTML(),
        rtf: clipboard.readRTF(),
        image: image.isEmpty() ? null : image,
        bookmark: bookmark.url ? bookmark : null,
        buffers
    }
}

function restoreClipboard(backup: ClipboardBackup): void {
    clipboard.clear()

    const payload: Electron.Data = {}
    if (backup.text) payload.text = backup.text
    if (backup.html) payload.html = backup.html
    if (backup.rtf) payload.rtf = backup.rtf
    if (backup.image) payload.image = backup.image
    if (backup.bookmark) payload.bookmark = backup.bookmark.url
    clipboard.write(payload)

    if (backup.bookmark?.title && backup.bookmark.url) {
        clipboard.writeBookmark(backup.bookmark.title, backup.bookmark.url)
    }

    for (const [format, buffer] of backup.buffers) {
        if (buffer.length > 0) {
            clipboard.writeBuffer(format, buffer)
        }
    }
}

interface WaitForClipboardTextChangeOptions {
    interval_ms?: number
    timeout_ms?: number
}

async function waitForClipboardTextChange(
    sentinel: string,
    opts: WaitForClipboardTextChangeOptions = {}
): Promise<string | null> {
    const interval_ms = opts.interval_ms ?? 20
    const timeout_ms = opts.timeout_ms ?? 300
    const start = Date.now()

    while (Date.now() - start < timeout_ms) {
        await new Promise((resolve) => setTimeout(resolve, interval_ms))
        const current = clipboard.readText()
        if (current !== sentinel && current !== '') {
            return current
        }
    }

    return null
}

export async function getSelectedTextViaClipboard(
    simulateCopy: () => Promise<void>,
    withSuppression: <T>(fn: () => Promise<T>) => Promise<T>
): Promise<SelectedTextResult> {
    return withSuppression(async () => {
        let backup: ClipboardBackup | undefined

        try {
            backup = backupClipboard()

            const sentinel = `__OMNI_POT_COPY_SENTINEL_${randomUUID()}__`
            clipboard.writeText(sentinel)

            await simulateCopy()

            const newText = await waitForClipboardTextChange(sentinel)

            if (newText) {
                return { text: newText, method: 'clipboard' }
            }

            return { text: '', method: 'clipboard', reason: 'copy-failed' }
        } catch (error: unknown) {
            return { text: '', method: 'clipboard', reason: 'error', error }
        } finally {
            if (backup) {
                restoreClipboard(backup)
            }
        }
    })
}
