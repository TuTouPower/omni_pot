export enum WindowLabel {
  DAEMON = 'daemon',
  TRANSLATE = 'translate',
  SCREENSHOT = 'screenshot',
  RECOGNIZE = 'recognize',
  CONFIG = 'config',
  UPDATER = 'updater'
}

export interface WindowOptions {
  label: WindowLabel
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  resizable?: boolean
  alwaysOnTop?: boolean
  skipTaskbar?: boolean
  show?: boolean
  transparent?: boolean
  frame?: boolean
  focusable?: boolean
}
