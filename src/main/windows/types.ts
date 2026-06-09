export enum WindowLabel {
  DAEMON = 'daemon',
  TRANSLATE = 'translate',
  WELCOME = 'welcome',
  SCREENSHOT = 'screenshot',
  RECOGNIZE = 'recognize',
  DICT = 'dict',
  CONFIG = 'config',
  UPDATER = 'updater',
  TRAY = 'tray'
}

export interface WindowOptions {
  label: WindowLabel
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  maxHeight?: number
  resizable?: boolean
  alwaysOnTop?: boolean
  skipTaskbar?: boolean
  show?: boolean
  transparent?: boolean
  frame?: boolean
  focusable?: boolean
  backgroundThrottling?: boolean
}
