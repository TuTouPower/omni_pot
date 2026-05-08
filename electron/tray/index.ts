import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { WindowLabel } from '../windows/types'
import type { WindowManager } from '../windows/manager'
import {
    startClipboardMonitor,
    stopClipboardMonitor,
    isClipboardMonitoring
} from '../clipboard'
import { getConfig } from '../config/store'

let tray: Tray | null = null
let windowManager: WindowManager | null = null

export function setWindowManagerForTray(mgr: WindowManager): void {
  windowManager = mgr
}

function resolveIconPath(): string {
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(process.resourcesPath ?? '', 'icon.png'),
    join(app.getAppPath(), 'resources/icon.png')
  ]
  return candidates.find((p) => p && existsSync(p)) ?? candidates[0]
}

export function createTray(): void {
  const iconPath = resolveIconPath()
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Pot Desktop')

  tray.on('click', () => {
    const action = getConfig('tray_click_event') as string
    if (action === 'show_translate') {
      windowManager?.focusOrCreate(WindowLabel.TRANSLATE, {
        label: WindowLabel.TRANSLATE,
        width: 350,
        height: 420
      })
    } else if (action === 'show_config' || !action) {
      windowManager?.focusOrCreate(WindowLabel.CONFIG, {
        label: WindowLabel.CONFIG,
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 400
      })
    }
  })

  rebuildMenu()
}

function rebuildMenu(): void {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Input Translate',
      click: () => {
        windowManager?.focusOrCreate(WindowLabel.TRANSLATE, {
          label: WindowLabel.TRANSLATE,
          width: 350,
          height: 420
        })
      }
    },
    { type: 'separator' },
    {
      label: 'Clipboard Monitor',
      type: 'checkbox',
      checked: isClipboardMonitoring(),
      click: () => {
        if (isClipboardMonitoring()) {
          stopClipboardMonitor()
        } else if (windowManager) {
          startClipboardMonitor(windowManager)
        }
        rebuildMenu()
      }
    },
    { type: 'separator' },
    {
      label: 'Config',
      click: () => {
        windowManager?.focusOrCreate(WindowLabel.CONFIG, {
          label: WindowLabel.CONFIG,
          width: 800,
          height: 600,
          minWidth: 800,
          minHeight: 400
        })
      }
    },
    { type: 'separator' },
    {
      label: 'Restart',
      click: () => {
        app.relaunch()
        app.exit(0)
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
