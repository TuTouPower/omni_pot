import { ipcMain, app } from 'electron'
import type { ConfigKey } from '@shared/types/config'
import { DEFAULT_CONFIG } from '@shared/types/config'
import { getConfig, setConfig, getAllConfig, getUserDataDir } from '../config/store'
import { sanitize_config_secrets } from '../config/secrets'
import { rebuildMenu } from '../tray'
import { log } from '../log'
import type { WindowManager } from '../windows/manager'
import { WindowLabel } from '../windows/types'
import { assert_sender_label } from './sender_validation'

const log_ipc = log.scope('ipc:config')

function validate_config_value(key: ConfigKey, value: unknown): boolean {
  const default_val = DEFAULT_CONFIG[key]
  if (Array.isArray(default_val)) return Array.isArray(value)
  return typeof value === typeof default_val
}

function apply_auto_start(enabled: boolean): void {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: enabled })
  } else if (process.platform === 'linux') {
    // Linux autostart is handled via .desktop file — out of scope for now
  }
}

const config_read_labels = [
  WindowLabel.CONFIG,
  WindowLabel.WELCOME,
  WindowLabel.TRANSLATE,
  WindowLabel.DICT,
  WindowLabel.RECOGNIZE,
  WindowLabel.SCREENSHOT,
  WindowLabel.TRAY,
  WindowLabel.UPDATER,
] as const
const config_write_labels = [
  WindowLabel.CONFIG,
  WindowLabel.WELCOME,
  WindowLabel.TRANSLATE,
  WindowLabel.DICT,
  WindowLabel.RECOGNIZE,
] as const

const sensitive_write_keys = new Set<string>([
  'server_api_token', 'webdav_password', 'service_instances', 'auto_start',
])

export function registerConfigHandlers(manager: WindowManager): void {
  ipcMain.handle('config:get', (event, key: ConfigKey) => {
    assert_sender_label(manager, event, config_read_labels, 'config:get')
    return getConfig(key)
  })
  ipcMain.handle('config:set', (event, key: ConfigKey, value: unknown) => {
    const sender_label = assert_sender_label(manager, event, config_write_labels, 'config:set')
    if (!validate_config_value(key, value)) {
      log_ipc.warn('rejected config:set with wrong type for %s: expected %s, got %s',
        key, typeof DEFAULT_CONFIG[key], typeof value)
      return
    }
    if (sender_label !== WindowLabel.CONFIG && sensitive_write_keys.has(key)) {
      log_ipc.warn('rejected config:set for sensitive key %s from non-config window %s', key, sender_label)
      return
    }
    setConfig(key, value)
    if (key === 'app_language') {
      rebuildMenu()
    }
    if (key === 'auto_start' && !process.env['OMNI_POT_E2E']) {
      apply_auto_start(value as boolean)
    }
  })
  ipcMain.handle('config:getAll', (event) => {
    const sender_label = assert_sender_label(manager, event, config_read_labels, 'config:getAll')
    const all_config = getAllConfig()
    if (sender_label === WindowLabel.CONFIG) return all_config
    return sanitize_config_secrets(all_config)
  })
  ipcMain.handle('config:getUserDir', (event) => {
    assert_sender_label(manager, event, [WindowLabel.CONFIG], 'config:getUserDir')
    return getUserDataDir()
  })

  // Apply auto_start on startup
  if (getConfig('auto_start') && !process.env['OMNI_POT_E2E']) {
    apply_auto_start(true)
  }
}
